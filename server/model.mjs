export function preliminaryReviews(seed, now) {
  return Object.fromEntries(
    seed.interviews
      .flatMap((i) => i.turns)
      .filter(
        (t) =>
          t.kind === "participant" && (t.suggestedCodes.length || t.priorMemo),
      )
      .map((t) => [
        t.id,
        {
          codes: [...t.suggestedCodes],
          status: "unreviewed",
          memo: t.priorMemo ?? "",
          evidence: structuredClone(t.evidence ?? []),
          stance: "unspecified",
          target: "unspecified",
          origin: "preliminary",
          updatedAt: now,
        },
      ]),
  );
}
export function initialState(seed) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    revision: 0,
    codebookVersion: seed.codebookVersion,
    codes: structuredClone(seed.codebook),
    reviews: preliminaryReviews(seed, now),
    events: [],
    updatedAt: now,
    preliminaryLoadedAt: now,
  };
}
export function loadPreliminary(state, seed) {
  const next = structuredClone(state),
    now = new Date().toISOString();
  const initial = preliminaryReviews(seed, now);
  for (const [id, review] of Object.entries(initial))
    if (!Object.hasOwn(next.reviews, id))
      next.reviews[id] = {
        ...review,
        codes: review.codes.filter((id) =>
          next.codes.some((c) => c.id === id && c.active),
        ),
      };
  next.preliminaryLoadedAt = now;
  next.updatedAt = now;
  next.revision++;
  next.events.push({
    revision: next.revision,
    at: now,
    action: {
      type: "load-preliminary",
      note: "Loaded prior assignments and memos for review, preserving existing passage edits.",
    },
  });
  return next;
}
export function restoreState(current, seed, saved, filename) {
  const fail = () => {
    throw Object.assign(
      Error(
        "Snapshot is incompatible or incomplete; current coding is unchanged.",
      ),
      { status: 400 },
    );
  };
  if (
    saved?.schemaVersion !== 1 ||
    !Array.isArray(saved.codes) ||
    !saved.codes.length ||
    !saved.reviews ||
    typeof saved.reviews !== "object" ||
    Array.isArray(saved.reviews)
  )
    fail();
  const ids = new Set();
  for (const c of saved.codes) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !/^C\d+$/.test(c.id) ||
      ids.has(c.id) ||
      typeof c.name !== "string" ||
      typeof c.definition !== "string" ||
      typeof c.active !== "boolean" ||
      !seed.groups.some((g) => g.id === c.group) ||
      !Array.isArray(c.researchQuestions) ||
      c.researchQuestions.some((id) => !seed.groups.some((g) => g.id === id))
    )
      fail();
    ids.add(c.id);
  }
  const turns = new Map(
    seed.interviews
      .flatMap((i) => i.turns)
      .filter((t) => t.kind === "participant")
      .map((t) => [t.id, t]),
  );
  for (const [id, r] of Object.entries(saved.reviews)) {
    if (
      !turns.has(id) ||
      !r ||
      !Array.isArray(r.codes) ||
      r.codes.some((c) => !ids.has(c)) ||
      !["unreviewed", "reviewed", "revisit"].includes(r.status) ||
      typeof r.memo !== "string" ||
      !["unspecified", "positive", "concerned", "mixed", "neutral"].includes(
        r.stance,
      ) ||
      ![
        "unspecified",
        "current practice",
        "OCIS schema",
        "AI",
        "application",
        "unclear",
      ].includes(r.target)
    )
      fail();
    if (r.evidence !== undefined) {
      if (!Array.isArray(r.evidence)) fail();
      const seen = new Set();
      for (const e of r.evidence) {
        if (!validEvidence(e, turns.get(id).text) || !r.codes.includes(e.codeId) || seen.has(e.id)) fail();
        seen.add(e.id);
      }
    }
    const version = seed.interviews.find(
      (i) => i.id === turns.get(id).interview,
    ).protocolVersion;
    if (
      r.question !== undefined &&
      !seed.protocol[version].some((q) => q.id === r.question)
    )
      fail();
  }
  const now = new Date().toISOString();
  return {
    ...current,
    codes: structuredClone(saved.codes),
    reviews: structuredClone(saved.reviews),
    codebookVersion: saved.codebookVersion,
    revision: current.revision + 1,
    updatedAt: now,
    events: [
      ...current.events,
      {
        revision: current.revision + 1,
        at: now,
        action: {
          type: "restore-snapshot",
          filename,
          restoredRevision: saved.revision,
        },
      },
    ],
  };
}
export function getReview(state, id) {
  return (
    state.reviews[id] ?? {
      codes: [],
      status: "unreviewed",
      memo: "",
      stance: "unspecified",
      target: "unspecified",
    }
  );
}
const fail = (s) => {
  throw Object.assign(new Error(s), { status: 400 });
};
const clean = (v, max = 2000) =>
  typeof v === "string" && v.length <= max
    ? v
    : fail("Invalid or excessively long text.");
export function validEvidence(e, text) {
  return e && typeof e.id === "string" && typeof e.codeId === "string" &&
    Number.isInteger(e.start) && Number.isInteger(e.end) && e.start >= 0 &&
    e.end > e.start && e.end <= text.length && text.slice(e.start, e.end) === e.text && e.text.trim().length > 0 &&
    // A range must not split a UTF-16 surrogate pair.
    !(/[\uDC00-\uDFFF]/.test(text[e.start] ?? "")) && !(/[\uDC00-\uDFFF]/.test(text[e.end] ?? ""));
}
export function applyAction(state, seed, action) {
  const next = structuredClone(state),
    now = new Date().toISOString();
  const turns = seed.interviews.flatMap((i) => i.turns);
  if (["toggle-code", "review", "use-suggestions", "toggle-span", "remove-span"].includes(action.type)) {
    const t = turns.find(
      (t) => t.id === action.passageId && t.kind === "participant",
    );
    if (!t) fail("Select a participant passage.");
    const review = {
      ...getReview(next, t.id),
      codes: [...getReview(next, t.id).codes],
    };
    if (action.type === "toggle-span" || action.type === "remove-span") {
      review.evidence = [...(review.evidence ?? [])];
      if (action.type === "remove-span") {
        const found = review.evidence.find(e => e.id === action.evidenceId);
        if (!found) fail("Evidence selection no longer exists.");
        review.evidence = review.evidence.filter(e => e.id !== found.id);
        if (!review.evidence.some(e => e.codeId === found.codeId)) review.codes = review.codes.filter(id => id !== found.codeId);
      } else {
        const c = next.codes.find(c => c.id === action.codeId && c.active);
        if (!c) fail("Code is unavailable.");
        const evidence = { id: `${c.id}:${action.start}:${action.end}`, codeId: c.id, start: action.start, end: action.end, text: action.text, origin: "manual", updatedAt: now };
        if (!validEvidence(evidence, t.text)) fail("Select an exact, non-empty range inside one participant passage.");
        const exists = review.evidence.some(e => e.codeId === c.id && e.start === evidence.start && e.end === evidence.end);
        if (exists) {
          review.evidence = review.evidence.filter(e => !(e.codeId === c.id && e.start === evidence.start && e.end === evidence.end));
          if (!review.evidence.some(e => e.codeId === c.id)) review.codes = review.codes.filter(id => id !== c.id);
        } else {
          review.evidence.push(evidence);
          review.codes = [...new Set([...review.codes, c.id])];
        }
      }
      if (review.status === "reviewed") review.status = "revisit";
    } else if (action.type === "toggle-code") {
      const c = next.codes.find((c) => c.id === action.codeId);
      if (!c || !c.active) fail("Code is unavailable.");
      review.evidence = (review.evidence ?? []).filter(e => e.codeId !== c.id);
      review.codes = review.codes.includes(c.id)
        ? review.codes.filter((id) => id !== c.id)
        : [...review.codes, c.id];
      if (review.status === "reviewed") review.status = "revisit";
    } else if (action.type === "use-suggestions") {
      review.codes = [
        ...new Set([
          ...review.codes,
          ...t.suggestedCodes.filter((id) =>
            next.codes.some((c) => c.id === id && c.active),
          ),
        ]),
      ];
      review.status = "revisit";
    } else {
      const p = action.patch ?? {};
      if (p.status !== undefined) {
        if (!["unreviewed", "reviewed", "revisit"].includes(p.status))
          fail("Invalid status.");
        review.status = p.status;
      }
      if (p.memo !== undefined) review.memo = clean(p.memo, 10000);
      if (p.stance !== undefined) {
        if (
          ![
            "unspecified",
            "positive",
            "concerned",
            "mixed",
            "neutral",
          ].includes(p.stance)
        )
          fail("Invalid stance.");
        review.stance = p.stance;
      }
      if (p.target !== undefined) {
        if (
          ![
            "unspecified",
            "current practice",
            "OCIS schema",
            "AI",
            "application",
            "unclear",
          ].includes(p.target)
        )
          fail("Invalid target.");
        review.target = p.target;
      }
      if (p.question !== undefined) {
        const version = seed.interviews.find(
          (i) => i.id === t.interview,
        ).protocolVersion;
        if (!seed.protocol[version].some((q) => q.id === p.question))
          fail("Invalid question.");
        review.question = p.question;
      }
    }
    review.updatedAt = now;
    next.reviews[t.id] = review;
  } else if (["create-code", "edit-code"].includes(action.type)) {
    const code = action.code ?? {};
    const name = clean(code.name, 100).trim();
    if (!name) fail("A code needs a name.");
    if (
      next.codes.some(
        (c) =>
          c.active &&
          c.name.toLowerCase() === name.toLowerCase() &&
          c.id !== code.id,
      )
    )
      fail("An active code already has that name.");
    if (!seed.groups.some((g) => g.id === code.group))
      fail("Choose a research-question group.");
    const old =
      action.type === "edit-code"
        ? next.codes.find((c) => c.id === code.id)
        : undefined;
    if (action.type === "edit-code" && !old) fail("Code not found.");
    const id =
      old?.id ??
      `C${String(Math.max(0, ...next.codes.map((c) => Number(c.id.slice(1)))) + 1).padStart(2, "0")}`;
    const rqs = code.researchQuestions ?? [code.group];
    if (
      !Array.isArray(rqs) ||
      !rqs.length ||
      rqs.some((id) => !seed.groups.some((g) => g.id === id))
    )
      fail("Invalid research questions.");
    const value = {
      ...old,
      id,
      name,
      group: code.group,
      definition: clean(code.definition ?? ""),
      include: clean(code.include ?? ""),
      exclude: clean(code.exclude ?? ""),
      researchQuestions: [...new Set([code.group, ...rqs])],
      active: true,
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
    };
    if (old) {
      next.codes[next.codes.indexOf(old)] = value;
      for (const r of Object.values(next.reviews))
        if (r.codes.includes(old.id) && r.status === "reviewed")
          r.status = "revisit";
    } else next.codes.push(value);
    next.codebookVersion = `${next.codebookVersion.replace(/-r\d+$/, "")}-r${next.revision + 1}`;
  } else if (["archive-code", "restore-code"].includes(action.type)) {
    const c = next.codes.find((c) => c.id === action.codeId);
    if (!c) fail("Code not found.");
    if (
      action.type === "restore-code" &&
      next.codes.some(
        (x) =>
          x.active &&
          x.id !== c.id &&
          x.name.toLowerCase() === c.name.toLowerCase(),
      )
    )
      fail("Rename the matching active code before restoring.");
    c.active = action.type === "restore-code";
    c.updatedAt = now;
    for (const r of Object.values(next.reviews))
      if (r.codes.includes(c.id)) r.status = "revisit";
    next.codebookVersion = `${next.codebookVersion.replace(/-r\d+$/, "")}-r${next.revision + 1}`;
  } else fail("Unknown action.");
  next.revision++;
  next.updatedAt = now;
  next.events.push({
    revision: next.revision,
    at: now,
    action: structuredClone(action),
  });
  return next;
}
export function summarize(seed, state) {
  const all = seed.interviews
    .flatMap((i) => i.turns)
    .filter((t) => t.kind === "participant");
  return {
    total: all.length,
    reviewed: all.filter((t) => getReview(state, t.id).status === "reviewed")
      .length,
    coded: all.filter((t) =>
      getReview(state, t.id).codes.some((id) =>
        state.codes.some((c) => c.id === id && c.active),
      ),
    ).length,
    groups: seed.groups.map((g) => {
      const rows = all.filter((t) =>
        getReview(state, t.id).codes.some((id) =>
          state.codes.some((c) => c.id === id && c.group === g.id && c.active),
        ),
      );
      return {
        ...g,
        passages: rows.length,
        interviews: new Set(rows.map((t) => t.interview)).size,
      };
    }),
    codes: state.codes.map((c) => {
      const rows = all.filter((t) =>
        getReview(state, t.id).codes.includes(c.id),
      );
      return {
        ...c,
        passages: rows.length,
        interviews: new Set(rows.map((t) => t.interview)).size,
      };
    }),
  };
}
