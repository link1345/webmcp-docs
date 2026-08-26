import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 4321,
  },
  vite: {
    resolve: {
      alias: {
        "webmcp-docs": fileURLToPath(new URL("../../src/index.ts", import.meta.url)),
      },
    },
    server: {
      fs: {
        allow: [repositoryRoot],
      },
    },
  },
});
