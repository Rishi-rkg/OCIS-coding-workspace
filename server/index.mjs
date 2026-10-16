import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyAction } from "./model.mjs";
import { exportWorkbook } from "./export.mjs";
import { openStore } from "./storage.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT ?? 4317),
  host = "127.0.0.1";
const projectDirectory = path.resolve(process.env.OCIS_PROJECT_DIR ?? path.join(root, "projects/demo"));
const seed = JSON.parse(
  await fs.readFile(path.join(projectDirectory, "seed.json"), "utf8"),
);
const store = await openStore(
  process.env.OCIS_DATA_DIR ?? projectDirectory,
  seed,
);
let state = store.state;
let queue = Promise.resolve();
const production = process.argv.includes("--production");
const vite = production
  ? null
  : await (
      await import("vite")
    ).createServer({
      root,
      server: { middlewareMode: true, host, hmr: { host } },
      appType: "spa",
    });
function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}
async function body(req) {
  let s = "";
  for await (const chunk of req) {
    s += chunk;
    if (s.length > 100000)
      throw Object.assign(new Error("Request too large"), { status: 413 });
  }
  return JSON.parse(s);
}
const server = http.createServer(async (req, res) => {
  try {
    const allowed = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    if (!allowed.has(req.headers.host))
      return json(res, 403, { error: "Local access only" });
    if (req.headers.origin && !allowed.has(new URL(req.headers.origin).host))
      return json(res, 403, { error: "Origin not allowed" });
    const url = new URL(req.url, `http://${host}:${port}`);
    if (url.pathname === "/api/project" && req.method === "GET")
      return json(res, 200, { seed, state });
    if (url.pathname === "/api/snapshots" && req.method === "GET")
      return json(res, 200, { snapshots: await store.list() });
    if (
      ["/api/action", "/api/restore"].includes(url.pathname) &&
      req.method === "POST"
    ) {
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return json(res, 415, { error: "JSON required" });
      const input = await body(req);
      const task = queue.then(async () => {
        if (input.revision !== state.revision)
          throw Object.assign(
            new Error(
              "Another window changed this project. Reload to use its latest revision.",
            ),
            { status: 409 },
          );
        state =
          url.pathname === "/api/restore"
            ? await store.restore(state, input.filename)
            : await store.save(state, applyAction(state, seed, input.action));
        return state;
      });
      queue = task.catch(() => {});
      return json(res, 200, { state: await task });
    }
    if (url.pathname === "/api/export.xlsx" && req.method === "GET") {
      const bytes = await exportWorkbook(seed, state);
      res.writeHead(200, {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="OCIS-manual-coding.xlsx"',
        "Cache-Control": "no-store",
      });
      return res.end(bytes);
    }
    if (url.pathname === "/api/backup.json" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="OCIS-coding-backup.json"',
      });
      return res.end(JSON.stringify({ seed, state }, null, 2));
    }
    if (url.pathname.startsWith("/api/"))
      return json(res, 404, { error: "Not found" });
    if (vite) return vite.middlewares(req, res);
    const filename = url.pathname.startsWith("/assets/")
      ? path.resolve(root, "dist", "." + url.pathname)
      : path.join(root, "dist/index.html");
    if (!filename.startsWith(path.join(root, "dist") + path.sep))
      return json(res, 403, { error: "Not allowed" });
    const types = {
      ".js": "text/javascript",
      ".css": "text/css",
      ".html": "text/html",
      ".svg": "image/svg+xml",
    };
    res.writeHead(200, {
      "Content-Type":
        types[path.extname(filename)] ?? "application/octet-stream",
    });
    res.end(await fs.readFile(filename));
  } catch (e) {
    json(res, e.status ?? 500, { error: e.message });
  }
});
server.listen(port, host, () =>
  console.log(`OCIS coding workspace: http://${host}:${port}`),
);
