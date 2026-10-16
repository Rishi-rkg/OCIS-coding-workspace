import fs from "node:fs/promises";
import path from "node:path";
import { initialState, loadPreliminary, restoreState } from "./model.mjs";

export async function openStore(directory, seed) {
  const statePath = path.join(directory, "coding-state.json");
  const backups = path.join(directory, "backups");
  await fs.mkdir(backups, { recursive: true });
  async function snapshot(value) {
    const stamp = (value.updatedAt ?? new Date().toISOString()).replace(
      /:/g,
      "-",
    );
    const filename = `${stamp}_revision-${String(value.revision).padStart(6, "0")}.json`;
    const file = path.join(backups, filename);
    try {
      await fs.access(file);
      return;
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
    await fs.writeFile(file + ".tmp", JSON.stringify(value, null, 2) + "\n");
    await fs.rename(file + ".tmp", file);
  }
  async function save(previous, next) {
    if (previous) await snapshot(previous);
    await snapshot(next);
    await fs.writeFile(
      statePath + ".tmp",
      JSON.stringify(next, null, 2) + "\n",
    );
    await fs.rename(statePath + ".tmp", statePath);
    return next;
  }
  let state;
  try {
    state = JSON.parse(await fs.readFile(statePath, "utf8"));
    if (state.schemaVersion !== 1) throw Error("Unsupported state version");
  } catch (e) {
    if (e.code !== "ENOENT")
      throw Error(
        `Cannot read coding state; original file retained: ${e.message}`,
      );
    state = await save(null, initialState(seed));
  }
  if (!state.preliminaryLoadedAt)
    state = await save(state, loadPreliminary(state, seed));
  await snapshot(state);
  async function list() {
    const files = await fs.readdir(backups);
    const rows = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (filename) => {
          const stat = await fs.stat(path.join(backups, filename));
          const match = filename.match(/^(.*)_revision-(\d+)\.json$/);
          return {
            filename,
            revision: Number(
              match?.[2] ?? filename.match(/revision-(\d+)/)?.[1] ?? 0,
            ),
            savedAt: match
              ? match[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3")
              : stat.mtime.toISOString(),
          };
        }),
    );
    return rows.sort(
      (a, b) => b.revision - a.revision || b.savedAt.localeCompare(a.savedAt),
    );
  }
  async function restore(current, filename) {
    if (
      typeof filename !== "string" ||
      !/^[A-Za-z0-9_.-]+\.json$/.test(filename)
    )
      throw Object.assign(Error("Invalid snapshot name"), { status: 400 });
    let saved;
    try {
      saved = JSON.parse(
        await fs.readFile(path.join(backups, filename), "utf8"),
      );
    } catch (e) {
      throw Object.assign(
        Error("Snapshot cannot be read. Current coding is unchanged."),
        { status: e.code === "ENOENT" ? 404 : 400 },
      );
    }
    const next = restoreState(current, seed, saved, filename);
    return save(current, next);
  }
  return { state, save, list, restore };
}
