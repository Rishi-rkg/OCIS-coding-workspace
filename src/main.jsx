import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Download,
  Check,
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  X,
  MessageSquare,
  BookOpen,
  BarChart3,
  StickyNote,
  RotateCcw,
  Save,
  CheckCheck,
  FolderGit2,
} from "lucide-react";
import { getReview, summarize } from "../server/model.mjs";
import "./style.css";
const statusLabel = {
  unreviewed: "Not reviewed",
  reviewed: "Reviewed",
  revisit: "Revisit",
};
const time = (t) => t.replace(/^00:/, "").split(".")[0];
const emptyCode = {
  name: "",
  definition: "",
  include: "",
  exclude: "",
  group: "RQ1",
  researchQuestions: ["RQ1"],
};
function EvidenceText({text, evidence = [], selectedRange}) {
  const spans = [...evidence, ...(selectedRange ? [{...selectedRange,codeId:"Selection"}] : [])];
  const boundaries = [...new Set([0,text.length,...spans.flatMap(e=>[e.start,e.end])])].sort((a,b)=>a-b);
  return boundaries.slice(0,-1).map((a,i)=>{
    const b=boundaries[i+1], matches=spans.filter(e=>e.start<=a && e.end>=b);
    return matches.length ? <mark key={a} className={matches.some(e=>e.codeId==="Selection") ? "active-selection" : "evidence-mark"} title={[...new Set(matches.map(e=>e.codeId))].join(", ")}>{text.slice(a,b)}</mark> : <React.Fragment key={a}>{text.slice(a,b)}</React.Fragment>;
  });
}
function Modal({ title, children, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const old = document.activeElement;
    ref.current?.focus();
    return () => old?.focus();
  }, []);
  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const nodes = [
              ...ref.current.querySelectorAll(
                "button,input,textarea,select,a[href]",
              ),
            ].filter((el) => !el.disabled);
            if (e.shiftKey && document.activeElement === nodes[0]) {
              e.preventDefault();
              nodes.at(-1)?.focus();
            } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
              e.preventDefault();
              nodes[0]?.focus();
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon" aria-label="Close dialog" onClick={onClose}>
            <X size={19} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function CodeForm({ code, groups, busy, onSave, onClose }) {
  const [draft, set] = useState({ ...emptyCode, ...code });
  const field = (key, v) => set({ ...draft, [key]: v });
  return (
    <Modal
      title={code?.id ? `Edit ${code.id}` : "Add a code"}
      onClose={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
      >
        <p className="muted">
          Describe the meaning you want to capture. Code IDs stay stable when
          labels change.
        </p>
        <label>
          Code label
          <input
            required
            maxLength={100}
            autoFocus
            value={draft.name}
            onChange={(e) => field("name", e.target.value)}
            placeholder="e.g. Missing context makes the record hard to trust"
          />
        </label>
        <label>
          Primary research question
          <select
            value={draft.group}
            onChange={(e) => field("group", e.target.value)}
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.id} · {g.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Definition
          <textarea
            required
            value={draft.definition}
            onChange={(e) => field("definition", e.target.value)}
            placeholder="What does this code mean?"
            rows={3}
          />
        </label>
        <div className="form-grid">
          <label>
            Include
            <textarea
              value={draft.include}
              onChange={(e) => field("include", e.target.value)}
              rows={3}
            />
          </label>
          <label>
            Exclude
            <textarea
              value={draft.exclude}
              onChange={(e) => field("exclude", e.target.value)}
              rows={3}
            />
          </label>
        </div>
        <fieldset>
          <legend>Other relevant research questions</legend>
          <div className="inline-options">
            {groups.map((g) => (
              <label key={g.id}>
                <input
                  type="checkbox"
                  checked={
                    draft.researchQuestions.includes(g.id) ||
                    draft.group === g.id
                  }
                  disabled={draft.group === g.id}
                  onChange={(e) =>
                    field(
                      "researchQuestions",
                      e.target.checked
                        ? [...draft.researchQuestions, g.id]
                        : draft.researchQuestions.filter((id) => id !== g.id),
                    )
                  }
                />
                {g.id}
              </label>
            ))}
          </div>
        </fieldset>
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            <Save size={16} />
            Save code
          </button>
        </footer>
      </form>
    </Modal>
  );
}
function NotesForm({ turn, review, questions, busy, onSave, onClose }) {
  const [draft, set] = useState({
    memo: review.memo,
    stance: review.stance,
    target: review.target,
    question: review.question ?? turn.question,
  });
  return (
    <Modal title={`Passage notes · ${turn.id}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft);
        }}
      >
        <label>
          Interview question (context tag source)
          <select
            value={draft.question}
            onChange={(e) =>
              set({ ...draft, question: Number(e.target.value) })
            }
          >
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.id ? `Q${q.id} · ` : ""}
                {q.title}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          Question alignment is a starting point. Correct it here if the
          conversation has moved to a different question.
        </p>
        <div className="form-grid">
          <label>
            Expressed stance
            <select
              value={draft.stance}
              onChange={(e) => set({ ...draft, stance: e.target.value })}
            >
              {["unspecified", "positive", "concerned", "mixed", "neutral"].map(
                (x) => (
                  <option key={x}>{x}</option>
                ),
              )}
            </select>
          </label>
          <label>
            What is the stance about?
            <select
              value={draft.target}
              onChange={(e) => set({ ...draft, target: e.target.value })}
            >
              {[
                "unspecified",
                "current practice",
                "OCIS schema",
                "AI",
                "application",
                "unclear",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Analytical memo
          <textarea
            rows={6}
            value={draft.memo}
            onChange={(e) => set({ ...draft, memo: e.target.value })}
            placeholder="Record your interpretation, uncertainty, or a counterexample…"
          />
        </label>
        {turn.priorMemo && (
          <p className="prior-note">
            <b>Earlier review note:</b> {turn.priorMemo}
          </p>
        )}
        <footer>
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            Save passage notes
          </button>
        </footer>
      </form>
    </Modal>
  );
}
function App() {
  const [range, setRange] = useState(null);
  const [sentencePicker, setSentencePicker] = useState(false);
  const [seed, setSeed] = useState(null),
    [state, setState] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [interviewId, setInterview] = useState("I01"),
    [selected, setSelected] = useState(""),
    [query, setQuery] = useState(""),
    [textSearch, setTextSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [editor, setEditor] = useState(null),
    [notes, setNotes] = useState(false),
    [stats, setStats] = useState(false),
    [history, setHistory] = useState(false),
    [snapshots, setSnapshots] = useState([]),
    [snapshotChoice, setSnapshotChoice] = useState(""),
    [showArchived, setShowArchived] = useState(false),
    [menu, setMenu] = useState(""),
    [deleted, setDeleted] = useState(null),
    [collapsed, setCollapsed] = useState({}),
    [suggestions, setSuggestions] = useState(false);
  const busyRef = useRef(false),
    stateRef = useRef(),
    scrollRef = useRef();
  useEffect(() => {
    fetch("/api/project")
      .then((r) => {
        if (!r.ok) throw Error("Could not load project.");
        return r.json();
      })
      .then(({ seed, state }) => {
        setSeed(seed);
        setInterview(seed.interviews[0].id);
        setState(state);
        stateRef.current = state;
        setSelected(
          seed.interviews[0].turns.find(
            (t) => t.kind === "participant" && t.suggestedCodes.length,
          )?.id ??
            seed.interviews[0].turns.find((t) => t.kind === "participant")?.id,
        );
      })
      .catch((e) => setError(e.message));
  }, []);
  async function act(action, endpoint = "/api/action", extra = {}) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: stateRef.current.revision,
          action,
          ...extra,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error);
      stateRef.current = data.state;
      setState(data.state);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function openHistory() {
    setHistory(true);
    setSnapshotChoice("");
    try {
      const r = await fetch("/api/snapshots");
      if (!r.ok) throw Error("Could not load snapshots");
      const data = await r.json();
      setSnapshots(data.snapshots);
    } catch (e) {
      setError(e.message);
    }
  }
  const interview = seed?.interviews.find((i) => i.id === interviewId),
    turn = interview?.turns.find((t) => t.id === selected),
    review = state && getReview(state, selected),
    allParticipants =
      interview?.turns.filter((t) => t.kind === "participant") ?? [],
    progress = seed && state ? summarize(seed, state) : null;
  function choose(id) {
    if(id !== selected) { setRange(null); setSentencePicker(false); }
    setSelected(id);
    setSuggestions(false);
    setMenu("");
  }
  function captureRange(event, passage) {
    const selection=window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;
    const r=selection.getRangeAt(0), el=event.currentTarget;
    if (!el.contains(r.startContainer) || !el.contains(r.endContainer)) return;
    const before=r.cloneRange(); before.selectNodeContents(el); before.setEnd(r.startContainer,r.startOffset);
    const start=before.toString().length, text=r.toString();
    if(!text.trim() || passage.text.slice(start,start+text.length)!==text) return;
    setSelected(passage.id); setRange({passageId:passage.id,start,end:start+text.length,text});
  }
  function switchInterview(id) {
    setInterview(id);
    setFilter("all");
    setTextSearch("");
    const ts = seed.interviews
      .find((i) => i.id === id)
      .turns.filter((t) => t.kind === "participant");
    choose(
      ts.find(
        (t) =>
          getReview(state, t.id).status !== "reviewed" && t.text.length > 80,
      )?.id ?? ts[0].id,
    );
  }
  function move(dir = 1, unreviewed = false) {
    const idx = allParticipants.findIndex((t) => t.id === selected);
    const after =
      dir > 0
        ? allParticipants.slice(idx + 1)
        : allParticipants.slice(0, idx).reverse();
    const t = after.find(
      (t) =>
        !unreviewed || getReview(stateRef.current, t.id).status !== "reviewed",
    );
    if (t) {
      setTextSearch("");
      setFilter("all");
      choose(t.id);
    }
  }
  useEffect(() => {
    const node = document.getElementById(selected);
    if (node && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: node.offsetTop - 20,
        behavior: "smooth",
      });
    }
  }, [selected, interviewId]);
  useEffect(() => {
    const listener = (e) => {
      if (
        /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
        editor ||
        notes ||
        stats ||
        history ||
        deleted ||
        busy
      )
        return;
      if (e.key === "j") {
        e.preventDefault();
        move(1);
      }
      if (e.key === "k") {
        e.preventDefault();
        move(-1);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  });
  if (!seed || !state)
    return (
      <div className="loading">
        <BookOpen size={30} />
        <h1>Opening your research workspace</h1>
        <p>{error || "Loading interviews and your saved coding…"}</p>
      </div>
    );
  const reviewedHere = allParticipants.filter(
    (t) => getReview(state, t.id).status === "reviewed",
  ).length;
  const activeCodes = state.codes.filter((c) => c.active),
    visibleCodes = state.codes.filter(
      (c) =>
        (c.active || showArchived) &&
        `${c.id} ${c.name} ${c.definition}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    );
  const questionFor = (t) =>
    seed.protocol[interview.protocolVersion].find(
      (q) => q.id === (getReview(state, t.id).question ?? t.question),
    );
  const q = turn && questionFor(turn);
  const matching = new Set(
    allParticipants
      .filter(
        (t) =>
          (filter === "all" ||
            (filter === "uncoded"
              ? !getReview(state, t.id).codes.some((id) =>
                  activeCodes.some((c) => c.id === id),
                )
              : getReview(state, t.id).status === filter)) &&
          (!textSearch ||
            t.text.toLowerCase().includes(textSearch.toLowerCase()) ||
            t.id.toLowerCase().includes(textSearch.toLowerCase())),
      )
      .map((t) => t.id),
  );
  const shown = interview.turns.filter((t, i) =>
    t.kind === "participant"
      ? matching.has(t.id)
      : (!textSearch && filter === "all") ||
        matching.has(
          interview.turns.slice(i + 1).find((x) => x.kind === "participant")
            ?.id,
        ),
  );
  const selectedCodes = review.codes
    .map((id) => state.codes.find((c) => c.id === id))
    .filter(Boolean);
  async function complete() {
    if (
      await act({
        type: "review",
        passageId: selected,
        patch: { status: "reviewed" },
      })
    )
      move(1, true);
  }
  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <BookOpen size={21} />
          </div>
          <div>
            <b>
              OCIS<span> / </span>Research workspace
            </b>
            <small>{seed.projectName ?? "Qualitative analysis"}</small>
          </div>
        </div>
        <div className="top-actions">
          <span className={"save-state " + (error ? "bad" : "")}>
            <i />
            {busy
              ? "Saving…"
              : error
                ? "Changes not saved"
                : "Saved on this computer"}
          </span>
          <button className="secondary" onClick={openHistory}>
            <RotateCcw size={16} />
            History
          </button>
          <button className="secondary" onClick={() => setStats(true)}>
            <BarChart3 size={16} />
            Overview
          </button>
          <a className="primary" href="/api/export.xlsx">
            <Download size={16} />
            Export Excel
          </a>
        </div>
      </header>
      <div className="review-summary">
        <span>
          {progress.coded} coded passages · {progress.reviewed} /{" "}
          {progress.total} reviewed
        </span>
        <span>{activeCodes.length} codes · {seed.interviews.length} interviews</span>
      </div>
      {error && (
        <div className="error" role="alert">
          {error}{" "}
          <button onClick={() => window.location.reload()}>
            Reload saved project
          </button>
        </div>
      )}
      <main className="workspace">
        <section className="transcript-pane" aria-label="Interview transcripts">
          <div
            className="interview-tabs"
            role="tablist"
            aria-label="Interviews"
          >
            {seed.interviews.map((i) => (
              <button
                role="tab"
                aria-selected={i.id === interviewId}
                key={i.id}
                onClick={() => switchInterview(i.id)}
              >
                {i.id}
                {i.id === interviewId && (
                  <span>
                    {reviewedHere}/{allParticipants.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="transcript-toolbar">
            <div className="search">
              <Search size={15} />
              <input
                aria-label="Search transcript"
                placeholder="Find a word or passage…"
                value={textSearch}
                onChange={(e) => setTextSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="Filter passages"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="all">All passages</option>
              <option value="unreviewed">Not reviewed</option>
              <option value="reviewed">Reviewed</option>
              <option value="revisit">Revisit</option>
              <option value="uncoded">No codes selected</option>
            </select>
            <select
              aria-label="Jump to interview question"
              value={q?.id ?? 0}
              onChange={(e) => {
                const t = allParticipants.find(
                  (t) => questionFor(t).id === Number(e.target.value),
                );
                if (t) {
                  setFilter("all");
                  setTextSearch("");
                  choose(t.id);
                }
              }}
            >
              {seed.protocol[interview.protocolVersion]
                .filter((q) =>
                  allParticipants.some((t) => questionFor(t).id === q.id),
                )
                .map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.id ? `Q${q.id} · ` : ""}
                    {q.section}
                  </option>
                ))}
            </select>
          </div>
          <div className="transcript-scroll" ref={scrollRef}>
            <div className="interview-context">
              <span className="eyebrow">INTERVIEW {interviewId.slice(1)}</span>
              <h2>{interview.role}</h2>
              <p>
                Protocol {interview.protocolVersion} <span>·</span>{" "}
                {allParticipants.length} participant passages <span>·</span>{" "}
                <kbd>J</kbd> / <kbd>K</kbd> to move
              </p>
            </div>
            {shown.length === 0 && (
              <div className="empty">
                <Search />
                <h3>No passages match</h3>
                <p>Try another word or clear the filters.</p>
                <button
                  className="secondary"
                  onClick={() => {
                    setFilter("all");
                    setTextSearch("");
                  }}
                >
                  Clear filters
                </button>
              </div>
            )}
            {shown.map((t, i) => {
              const tq = questionFor(t),
                r = getReview(state, t.id),
                isParticipant = t.kind === "participant",
                isSelected = t.id === selected;
              return (
                <React.Fragment key={t.id}>
                  {(i === 0 || questionFor(shown[i - 1]).id !== tq.id) && (
                    <div className="section-heading">
                      <span>
                        {tq.id ? `Q${String(tq.id).padStart(2, "0")}` : "INTRO"}
                      </span>
                      <div>
                        <b>{tq.section}</b>
                        <p>{tq.title}</p>
                      </div>
                    </div>
                  )}
                  {isParticipant ? (
                    <article
                      id={t.id}
                      className={`passage ${isSelected ? "selected" : ""}`}
                      tabIndex={0}
                      role="button"
                      aria-label={`Select ${t.id}`}
                      aria-pressed={isSelected}
                      onClick={() => { if (window.getSelection()?.isCollapsed !== false) choose(t.id); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          choose(t.id);
                        }
                      }}
                    >
                      <div className="passage-meta">
                        <span className="avatar">{t.interview.slice(-2)}</span>
                        <b>{t.speaker}</b>
                        <span>
                          {time(t.start)} – {time(t.end)}
                        </span>
                        <span className={`review-tag ${r.status}`}>
                          {r.status === "reviewed" && <Check size={12} />}{" "}
                          {statusLabel[r.status]}
                        </span>
                      </div>
                      <p className="speech" onMouseUp={e=>captureRange(e,t)} onKeyUp={e=>captureRange(e,t)}><EvidenceText text={t.text} evidence={r.evidence} selectedRange={range?.passageId===t.id ? range : null}/></p>
                      <div className="context-tags">
                        {tq.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                      {r.codes.length > 0 && (
                        <div className="applied-tags">
                          {r.codes.map((id) => {
                            const c = state.codes.find((c) => c.id === id);
                            return (
                              c && (
                                <span key={id}>
                                  {c.id} · {c.name}
                                  {!c.active ? " (archived)" : ""}
                                </span>
                              )
                            );
                          })}
                        </div>
                      )}
                      <div className="passage-bottom">
                        <span>{t.id}</span>
                        {r.memo && (
                          <span>
                            <StickyNote size={12} /> Memo
                          </span>
                        )}
                        <span>
                          {isSelected ? "SELECTED FOR CODING" : "CLICK TO CODE"}
                        </span>
                      </div>
                    </article>
                  ) : (
                    <div className="interviewer">
                      <div>
                        INTERVIEWER <span>{time(t.start)}</span>
                      </div>
                      <p>{t.text}</p>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
            <div className="end-note">
              End of {interviewId} · {reviewedHere} of {allParticipants.length}{" "}
              reviewed
            </div>
          </div>
          <footer className="transcript-footer">
            <span>
              <MessageSquare size={14} /> Context tags come from the interview
              guide.
            </span>
            <span>They are not evidence codes.</span>
          </footer>
        </section>
        <aside className="coding-pane" aria-label="Code selection">
          <div className="coding-heading">
            <div>
              <span className="eyebrow">YOUR INTERPRETATION</span>
              <h2>{range?.passageId===selected ? "Code selected text" : "Code this passage"}</h2>
            </div>
            <button
              className="icon"
              title="Passage notes and context"
              aria-label="Passage notes and context"
              onClick={() => setNotes(true)}
            >
              <StickyNote size={19} />
            </button>
          </div>
          <div className="selected-context">
            <span className="dot" />
            <b>{selected}</b>
            <span>{q?.section}</span>
            <button className="text-button" onClick={() => setNotes(true)}>
              Edit context
            </button>
          </div>
          <div className="evidence-controls">
            <p>Select words in the transcript, or choose a sentence below. Several codes can share the same selection.</p>
            <button className="secondary" onClick={()=>setSentencePicker(!sentencePicker)}>Choose a sentence</button>
            {sentencePicker && <div className="sentence-picker">{[...new Intl.Segmenter("en",{granularity:"sentence"}).segment(turn.text)].map(seg=><button key={seg.index} onClick={()=>{setRange({passageId:selected,start:seg.index,end:seg.index+seg.segment.length,text:seg.segment});setSentencePicker(false);}}>{seg.segment}</button>)}</div>}
            {range?.passageId===selected && <div className="range-preview"><blockquote>{range.text}</blockquote><button className="text-button" onClick={()=>{setRange(null);window.getSelection()?.removeAllRanges();}}>Clear selection · return to passage</button></div>}
            {(review.evidence ?? []).length>0 && <details><summary>{review.evidence.length} saved evidence selections</summary>{review.evidence.map(e=><div className="evidence-item" key={e.id}><button className="text-button" onClick={()=>setRange({...e,passageId:selected})}>{e.codeId} · {e.text}</button><button className="icon" disabled={busy} aria-label={`Remove evidence ${e.codeId} ${e.start}`} onClick={()=>act({type:"remove-span",passageId:selected,evidenceId:e.id})}><X size={14}/></button></div>)}</details>}
            {review.codes.some(id=>!(review.evidence??[]).some(e=>e.codeId===id)) && <small>Some codes apply to the whole passage. Selecting evidence for a code replaces its unlocated assignment with the exact text.</small>}
          </div>
          <div className="code-tools">
            <div className="search">
              <Search size={15} />
              <input
                aria-label="Search codes"
                placeholder="Find a code or meaning…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              className="add-code"
              onClick={() => setEditor({ ...emptyCode })}
            >
              <Plus size={16} />
              New code
            </button>
          </div>
          <div className="code-list">
            <div className="list-caption">
              SELECT ALL THAT APPLY{" "}
              <label>
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                />
                Show archived
              </label>
            </div>
            {seed.groups.map((g) => {
              const codes = visibleCodes.filter((c) => c.group === g.id);
              if (!codes.length) return null;
              return (
                <section className="rq-group" key={g.id}>
                  <button
                    className="group-title"
                    aria-expanded={!collapsed[g.id]}
                    onClick={() =>
                      setCollapsed({ ...collapsed, [g.id]: !collapsed[g.id] })
                    }
                  >
                    <span>{g.id}</span>
                    <b>{g.name}</b>
                    {collapsed[g.id] ? (
                      <ChevronRight size={16} />
                    ) : (
                      <ChevronDown size={16} />
                    )}
                  </button>
                  <p className="rq-question">{g.question}</p>
                  {!collapsed[g.id] &&
                    codes.map((c) => {
                      const chosen = range?.passageId===selected ? (review.evidence??[]).some(e=>e.codeId===c.id && e.start===range.start && e.end===range.end) : review.codes.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          className={`code-row ${chosen ? "chosen" : ""} ${!c.active ? "archived" : ""}`}
                        >
                          <button
                            className="code-toggle"
                            role="checkbox"
                            aria-checked={chosen}
                            aria-label={`${c.id} ${c.name}`}
                            disabled={busy || !c.active}
                            onClick={() =>
                              act({
                                type: range?.passageId===selected ? "toggle-span" : "toggle-code",
                                passageId: selected,
                                codeId: c.id,
                                ...(range?.passageId===selected ? {start:range.start,end:range.end,text:range.text} : {}),
                              })
                            }
                          >
                            <span className="checkbox">
                              {chosen && <Check size={13} />}
                            </span>
                            <div>
                              <span className="code-id">{c.id}</span>
                              <strong>{c.name}</strong>
                              <p>{c.definition}</p>
                            </div>
                          </button>
                          <div className="code-menu-wrap">
                            {c.active ? (
                              <button
                                className="icon"
                                aria-label={`Options for ${c.id}`}
                                onClick={() =>
                                  setMenu(menu === c.id ? "" : c.id)
                                }
                              >
                                <MoreHorizontal size={18} />
                              </button>
                            ) : (
                              <button
                                className="icon"
                                aria-label={`Restore ${c.id}`}
                                disabled={busy}
                                onClick={() =>
                                  act({ type: "restore-code", codeId: c.id })
                                }
                              >
                                <RotateCcw size={16} />
                              </button>
                            )}
                            {menu === c.id && (
                              <div className="code-menu">
                                <button
                                  onClick={() => {
                                    setEditor(c);
                                    setMenu("");
                                  }}
                                >
                                  <Pencil size={14} />
                                  Edit code
                                </button>
                                <button
                                  className="danger"
                                  onClick={() => {
                                    setDeleted(c);
                                    setMenu("");
                                  }}
                                >
                                  <Trash2 size={14} />
                                  Delete code
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </section>
              );
            })}
            {visibleCodes.length === 0 && (
              <div className="empty">
                <p>No matching codes.</p>
                <button
                  className="secondary"
                  onClick={() => setEditor({ ...emptyCode, name: query })}
                >
                  <Plus size={16} />
                  Create this code
                </button>
              </div>
            )}
            <div className="prior">
              <button
                className="prior-heading"
                aria-expanded={suggestions}
                onClick={() => setSuggestions(!suggestions)}
              >
                <BookOpen size={15} />
                Preliminary coding reference
                <span>{turn?.suggestedCodes.length ?? 0}</span>
                <ChevronDown size={15} />
              </button>
              {suggestions && (
                <div>
                  <p>
                    Original assignments from the preliminary analysis. These
                    were loaded as your starting point; any later changes are
                    saved separately.
                  </p>
                  {turn?.suggestedCodes.map((id) => (
                    <span className="suggestion" key={id}>
                      {id} · {state.codes.find((c) => c.id === id)?.name ?? id}
                    </span>
                  ))}
                  {!turn?.suggestedCodes.length ? (
                    <small>No prior codes assigned to this passage.</small>
                  ) : (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        act({ type: "use-suggestions", passageId: selected })
                      }
                    >
                      Reapply missing preliminary codes
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <footer className="coding-footer">
            <div className="selected-count">
              <b>
                {selectedCodes.length} code
                {selectedCodes.length === 1 ? "" : "s"} selected
              </b>
              <select
                aria-label="Review status"
                value={review.status}
                disabled={busy}
                onChange={(e) =>
                  act({
                    type: "review",
                    passageId: selected,
                    patch: { status: e.target.value },
                  })
                }
              >
                {Object.entries(statusLabel).map(([v, l]) => (
                  <option value={v} key={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="footer-actions">
              <button
                className="secondary"
                aria-label="Previous passage"
                onClick={() => move(-1)}
                disabled={busy || allParticipants[0]?.id === selected}
              >
                <ArrowLeft size={17} />
              </button>
              <button className="primary" disabled={busy} onClick={complete}>
                <CheckCheck size={17} />
                Reviewed & next
              </button>
              <button
                className="secondary"
                aria-label="Next passage"
                onClick={() => move(1)}
                disabled={busy || allParticipants.at(-1)?.id === selected}
              >
                <ArrowRight size={17} />
              </button>
            </div>
            <p>Selections save automatically. Review can include no codes.</p>
          </footer>
        </aside>
      </main>
      <footer className="app-footer">
        <span>
          <FolderGit2 size={13} />
          Local research project
        </span>
        <span>
          Codebook {state.codebookVersion} · Revision {state.revision}
        </span>
        <a href="/api/backup.json">Download backup</a>
      </footer>
      {history && (
        <Modal title="Saved history" onClose={() => setHistory(false)}>
          <p>
            Every coding change saves a dated snapshot in{" "}
            <code>data/backups/</code>. Restoring brings back the codebook,
            assignments, notes and review status. Your current work is also kept
            as a snapshot.
          </p>
          <label>
            Snapshot to restore
            <select
              value={snapshotChoice}
              onChange={(e) => setSnapshotChoice(e.target.value)}
            >
              <option value="">Choose a saved version…</option>
              {snapshots.map((s) => (
                <option key={s.filename} value={s.filename}>
                  {new Date(s.savedAt).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "medium",
                  })}{" "}
                  · Revision {s.revision}
                  {s.revision === state.revision ? " (current)" : ""}
                </option>
              ))}
            </select>
          </label>
          {snapshotChoice && <p className="snapshot-file">{snapshotChoice}</p>}
          <p className="muted">
            Times are shown in your local time zone. Snapshot filenames use UTC.
          </p>
          <footer>
            <button className="secondary" onClick={() => setHistory(false)}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy || !snapshotChoice}
              onClick={async () => {
                if (
                  await act(null, "/api/restore", { filename: snapshotChoice })
                ) {
                  setHistory(false);
                  setQuery("");
                  setShowArchived(false);
                }
              }}
            >
              <RotateCcw size={15} />
              Restore snapshot
            </button>
          </footer>
        </Modal>
      )}
      {editor && (
        <CodeForm
          code={editor}
          groups={seed.groups}
          busy={busy}
          onClose={() => setEditor(null)}
          onSave={async (code) => {
            if (
              await act({ type: code.id ? "edit-code" : "create-code", code })
            )
              setEditor(null);
          }}
        />
      )}
      {notes && (
        <NotesForm
          turn={turn}
          review={review}
          questions={seed.protocol[interview.protocolVersion]}
          busy={busy}
          onClose={() => setNotes(false)}
          onSave={async (patch) => {
            if (await act({ type: "review", passageId: selected, patch }))
              setNotes(false);
          }}
        />
      )}
      {deleted && (
        <Modal title={`Delete ${deleted.id}?`} onClose={() => setDeleted(null)}>
          <p>
            “{deleted.name}” will be archived and hidden from the code picker.
            Existing assignments and history are retained, and affected passages
            are flagged for another review.
          </p>
          <p>
            You can restore it using <b>Show archived</b>.
          </p>
          <footer>
            <button className="secondary" onClick={() => setDeleted(null)}>
              Keep code
            </button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={async () => {
                if (await act({ type: "archive-code", codeId: deleted.id }))
                  setDeleted(null);
              }}
            >
              Archive code
            </button>
          </footer>
        </Modal>
      )}
      {stats && (
        <Modal
          title="Your analysis at a glance"
          onClose={() => setStats(false)}
        >
          <p className="muted">
            Current coding includes preliminary assignments and your edits.
            Review status identifies passages you have checked. These
            research-question groups remain provisional.
          </p>
          <div className="stat-pills">
            <div>
              <b>
                {progress.reviewed}/{progress.total}
              </b>
              <span>reviewed passages</span>
            </div>
            <div>
              <b>{progress.coded}</b>
              <span>passages with active codes</span>
            </div>
          </div>
          <table className="overview-table">
            <thead>
              <tr>
                <th>Research question</th>
                <th>Passages</th>
                <th>Interviews</th>
              </tr>
            </thead>
            <tbody>
              {progress.groups.map((g) => (
                <tr key={g.id}>
                  <td>
                    <b>{g.id}</b> {g.name}
                  </td>
                  <td>{g.passages}</td>
                  <td>{g.interviews}/{seed.interviews.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">
            Each passage counts once within a group. A passage may contribute to
            several groups. Coverage is not agreement.
          </p>
          <footer>
            <a className="secondary" href="/api/backup.json">
              Download backup
            </a>
            <a className="primary" href="/api/export.xlsx">
              <Download size={16} />
              Export Excel
            </a>
          </footer>
        </Modal>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
