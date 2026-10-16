# OCIS coding workspace

A local Node.js + React workspace for qualitative coding. Research projects live outside this repository. The included demonstration is fictional.

## Start

Requires Node.js 22.12 or newer. Install dependencies with `npm install` (or `pnpm install --frozen-lockfile`). Run `npm run demo`, then `npm run dev`; open http://127.0.0.1:4317.

For a research project, place a compatible `seed.json` in a private folder and start with:

```sh
OCIS_PROJECT_DIR="/absolute/path/to/private/project" npm run dev
```

Set `PORT` to use another local port. For production: `npm run build`, then run `npm start` with the same project environment. The server binds only to 127.0.0.1. It does not send project content to an external coding service.

## Code evidence

Select text within one participant bubble, then select one or several codes. Alternatively use **Choose a sentence**; this also provides a keyboard-accessible route. Selected text stays visible in the right panel while you choose codes. Different codes may overlap. Identical text appearing twice is distinguished by its position.

**Clear selection** returns to whole-passage coding. Selecting a code at passage level removes all its assignments on that passage if already selected. Adding a specific span to an old unlocated code locates that assignment; add further spans to preserve multiple relevant excerpts. Remove an individual span from **saved evidence selections**. Removing its last span removes that code from the passage. Existing passage-level assignments remain visible without pretending that their evidence has already been located.

Codes can be added, edited and archived. Archived assignments stay in history and Excel. Review status is separate from coding: a reviewed passage may have no codes. Changes to reviewed coding flag the passage for another look.

## Storage and export

The private project folder contains `seed.json`, `coding-state.json` and `backups/`. Every change saves dated UTC snapshots and a revision event. **History** restores a snapshot as a new revision, preserving the previous one. Keep backups together with their original seed; timestamps refer to saving, not interview recording. Avoid running multiple server processes against the same project folder. Concurrent browser edits are protected by revision checking.

Excel includes a codebook, coding matrix, transcript, research-question summaries, exact evidence spans and revision log. New codes get new columns. Summary counts deduplicate passage/code pairs: two spans for one code in one turn still count as one coded passage. Evidence offsets use JavaScript UTF-16 positions, with the end exclusive. Turn timestamps locate the containing VTT turn; sentence timestamps are not inferred.

`examples/demo-seed.json` documents the seed structure. Interviews contain stable turn IDs, participant/interviewer roles, source text and protocol-question IDs. Question tags are context labels, not evidence. Optional turn `evidence` entries require `{id, codeId, start, end, text}` with an exact source match; `suggestedCodes` must contain their codes. Initial assignments remain unreviewed.

## Validation and publishing

Run `npm test` and `npm run build`. Tests cover source-range validation, repeated text, overlaps, Unicode boundaries, save/reload/restore and Excel expansion.

This repository contains application source and synthetic examples only. `projects/`, `data/`, dependencies and build products are ignored. Before publishing, inspect staged files and ensure no private project folder, transcript, export or backup is added. No remote has been configured. Choose an appropriate license before distributing the code.
