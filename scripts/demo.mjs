import fs from "node:fs/promises";
await fs.mkdir(new URL("../projects/demo/",import.meta.url),{recursive:true});
await fs.copyFile(new URL("../examples/demo-seed.json",import.meta.url),new URL("../projects/demo/seed.json",import.meta.url));
console.log("Demo ready. Run npm run dev.");
