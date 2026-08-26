import { createRequire } from "node:module";

import * as esm from "../dist/index.js";

const require = createRequire(import.meta.url);
const cjs = require("../dist/index.cjs");

for (const [format, module] of [
  ["ESM", esm],
  ["CommonJS", cjs],
]) {
  if (typeof module.registerDocsWebMcp !== "function") {
    throw new Error(`${format} build does not export registerDocsWebMcp.`);
  }
}
