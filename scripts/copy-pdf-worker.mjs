import { copyFile, mkdir, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
const require = createRequire(import.meta.url);
const packagePath = require.resolve("pdfjs-dist/package.json");
const { version } = JSON.parse(await readFile(packagePath, "utf8"));
const target = resolve("public/pdfjs");
await mkdir(target, { recursive: true });
await copyFile(
  resolve(dirname(packagePath), "build/pdf.worker.min.mjs"),
  resolve(target, `pdf.worker-${version}.min.mjs`),
);
