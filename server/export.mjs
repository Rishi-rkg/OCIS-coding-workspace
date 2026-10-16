import ExcelJS from "exceljs";
import { getReview, summarize } from "./model.mjs";
export async function exportWorkbook(seed, state) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "OCIS research";
  wb.created = new Date();
  function sheet(name, headers, rows, widths) {
    const s = wb.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 1, xSplit: 1 }],
    });
    s.addRow(headers);
    s.addRows(rows);
    s.columns.forEach((c, i) => {
      c.width = widths?.[i] ?? 24;
    });
    s.getRow(1).height = 32;
    s.getRow(1).eachCell((c) => {
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF233B37" },
      };
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    });
    s.eachRow((r, n) => {
      r.alignment = { vertical: "top", wrapText: true };
      if (n > 1) r.height = name === "Transcript" ? 90 : 45;
    });
    s.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, rows.length + 1), column: headers.length },
    };
    return s;
  }
  const summary = summarize(seed, state),
    participants = seed.interviews
      .flatMap((i) => i.turns)
      .filter((t) => t.kind === "participant");
  sheet(
    "Read me",
    ["Item", "Value"],
    [
      ["Exported", new Date().toISOString()],
      ["Codebook version", state.codebookVersion],
      ["Revision", state.revision],
      ["Reviewed passages", summary.reviewed],
      ["Participant passages", summary.total],
      [
        "Coding unit",
        "Exact text spans within participant turns. Legacy assignments without spans remain labelled as passage-level. Summary counts deduplicate each passage/code pair; they are not project incident counts.",
      ],
      [
        "Research-question groups",
        "Primary analytical groups aligned to RQ1, RQ2, RQ2a, RQ3 and RQ4. These are working groupings, not final themes.",
      ],
      [
        "Current and previous coding",
        "Coding starts with preliminary assignments and includes subsequent edits. Counts include pending-review coding; review status distinguishes confirmed passages. Preliminary coding preserves the original reference.",
      ],
      [
        "Deleted codes",
        "Archived codes remain in the codebook and coding matrix to preserve history. RQ summary counts active codes only.",
      ],
      [
        "Transcript",
        "Speaker labels use interview IDs. Exact participant speaker-name occurrences within speech are masked as [name redacted]. Other identifying details may remain in source wording.",
      ],
      [
        "Question alignment",
        "Protocol question anchors are initial mappings, not automatic evidence codes. Manual question corrections appear in Coding.",
      ],
      [
        "Counts",
        "Summary values describe this export snapshot. Export again after coding changes in the app. Raw source files are preserved in research/originals.",
      ],
    ],
    [28, 110],
  );
  sheet(
    "RQ summary",
    [
      "RQ",
      "Working interpretation",
      "Research question",
      "Distinct passages",
      "Interviews",
      "Reviewed passages",
    ],
    summary.groups.map((g) => [
      g.id,
      g.name,
      g.question,
      g.passages,
      g.interviews,
      participants.filter(
        (t) =>
          getReview(state, t.id).status === "reviewed" &&
          getReview(state, t.id).codes.some((id) =>
            state.codes.some(
              (c) => c.id === id && c.active && c.group === g.id,
            ),
          ),
      ).length,
    ]),
    [12, 65, 90, 20, 15, 20],
  );
  sheet(
    "Codebook",
    [
      "Code ID",
      "Code label",
      "Primary RQ",
      "Other linked RQs",
      "Definition",
      "Include",
      "Exclude",
      "Active",
      "Passages",
      "Interviews",
      "Earlier label",
    ],
    summary.codes.map((c) => [
      c.id,
      c.name,
      c.group,
      c.researchQuestions.join("; "),
      c.definition,
      c.include,
      c.exclude,
      c.active,
      c.passages,
      c.interviews,
      c.legacyName ?? "",
    ]),
    [12, 58, 14, 25, 80, 75, 75, 12, 14, 14, 50],
  );
  sheet(
    "Coding",
    [
      "Passage ID",
      "Interview",
      "Start",
      "End",
      "Question",
      "Section",
      "Protocol context tags",
      "Text",
      "Status",
      "Stance",
      "Stance target",
      "Memo",
      "Updated",
      ...state.codes.map(
        (c) => `${c.id} ${c.name}${c.active ? "" : " [archived]"}`,
      ),
    ],
    participants.map((t) => {
      const r = getReview(state, t.id),
        interview = seed.interviews.find((i) => i.id === t.interview),
        q = seed.protocol[interview.protocolVersion].find(
          (q) => q.id === (r.question ?? t.question),
        );
      return [
        t.id,
        t.interview,
        t.start,
        t.end,
        q.id,
        q.section,
        q.tags.join("; "),
        t.text,
        r.status,
        r.stance,
        r.target,
        r.memo,
        r.updatedAt ?? "",
        ...state.codes.map((c) => (r.codes.includes(c.id) ? 1 : 0)),
      ];
    }),
    [
      20,
      12,
      18,
      18,
      12,
      34,
      50,
      120,
      18,
      18,
      22,
      80,
      26,
      ...state.codes.map(() => 28),
    ],
  );
  sheet("Evidence spans", ["Passage ID", "Interview", "Code", "Label", "Scope", "Start offset (UTF-16)", "End offset (exclusive)", "Exact source text", "Turn start", "Turn end", "Review status", "Origin"], participants.flatMap(t => {
    const r = getReview(state,t.id);
    return r.codes.flatMap(codeId => {
      const spans = (r.evidence ?? []).filter(e => e.codeId === codeId);
      const label = state.codes.find(c => c.id === codeId)?.name ?? codeId;
      return spans.length ? spans.map(e => [t.id,t.interview,codeId,label,"Exact span",e.start,e.end,e.text,t.start,t.end,r.status,e.origin ?? r.origin ?? "manual"]) : [[t.id,t.interview,codeId,label,"Passage-level; select evidence","","","",t.start,t.end,r.status,r.origin ?? "manual"]];
    });
  }), [20,12,12,55,32,20,20,110,18,18,18,25]);
  sheet(
    "Transcript",
    [
      "Turn ID",
      "Interview",
      "Speaker",
      "Start",
      "End",
      "Text",
      "Initial protocol question",
    ],
    seed.interviews.flatMap((i) =>
      i.turns.map((t) => [
        t.id,
        i.id,
        t.speaker,
        t.start,
        t.end,
        t.text,
        t.question,
      ]),
    ),
    [20, 12, 16, 18, 18, 130, 25],
  );
  sheet(
    "Preliminary coding",
    ["Passage ID", "Original codes", "Prior note"],
    participants
      .filter((t) => t.suggestedCodes.length || t.priorMemo)
      .map((t) => [t.id, t.suggestedCodes.join("; "), t.priorMemo]),
    [20, 50, 110],
  );
  sheet(
    "Revision log",
    ["Revision", "Time", "Action", "Passage", "Code", "Details"],
    state.events.map((e) => [
      e.revision,
      e.at,
      e.action.type,
      e.action.passageId ?? "",
      e.action.codeId ?? e.action.code?.id ?? "",
      JSON.stringify(e.action),
    ]),
    [12, 28, 24, 20, 14, 120],
  );
  return Buffer.from(await wb.xlsx.writeBuffer());
}
