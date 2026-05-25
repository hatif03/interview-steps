import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "sql.js", "dist", "sql-wasm.wasm");
const destDir = join(root, "public", "vendor", "sql.js");
const dest = join(destDir, "sql-wasm.wasm");

if (!existsSync(src)) {
  console.warn("[copy-sql-wasm] sql.js wasm not found — run npm install first");
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("[copy-sql-wasm] copied sql-wasm.wasm to public/vendor/sql.js/");
