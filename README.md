# webmcp-docs

[日本語](./README.ja.md)

**webmcp-docs:** [![NPM Version](https://img.shields.io/npm/v/webmcp-docs)](https://www.npmjs.com/package/webmcp-docs) ![NPM Downloads](https://img.shields.io/npm/dw/webmcp-docs)<br>

`webmcp-docs` is a framework-agnostic library that exposes documentation search and retrieval as WebMCP tools. AI agents can use `search_docs` and `get_doc` to access documentation semantically instead of guessing how to operate search forms or navigate the DOM. When navigation pages are registered, `list_docs` also exposes the other pages and their sections. It uses `@mcp-b/global` to provide the WebMCP polyfill and MCP transports while preserving native browser support.

When this package is configured correctly, anyone can achieve a perfect score of 100 on `webmcp.ora.ai`!

## Installation

```sh
bun add webmcp-docs
```

## Minimal setup

```ts
import { registerDocsWebMcp } from "webmcp-docs";

const registration = await registerDocsWebMcp({
  pages: [
    { id: "/guide/getting-started", title: "Getting started", section: "Guide" },
    { id: "/guide/configuration", title: "Configuration", section: "Guide" },
  ],
  provider: {
    async search(query) {
      const response = await fetch(`/search-index.json?q=${encodeURIComponent(query)}`);
      return response.json();
    },
    async getDocument(id) {
      const response = await fetch(`/docs-data${id}.json`);
      return response.ok ? response.json() : null;
    },
  },
});

if (registration.status === "failed") {
  console.warn(registration.error.message);
}

// Unregister the tools when an SPA component is unmounted, for example.
registration.unregister();
```

Calling `registerDocsWebMcp` more than once for the same `document` returns the existing registration handle. To change the provider, call `unregister()` before registering again.

## Provider contract

A provider connects the library to data the site already owns, such as static JSON, a search index, or built Markdown output.

```ts
import type { DocsProvider } from "webmcp-docs";

const documents = [
  {
    id: "/guide/getting-started",
    title: "Getting started",
    excerpt: "Install and register webmcp-docs.",
    content: "# Getting started\n...",
  },
];

const provider: DocsProvider = {
  search(query) {
    const term = query.toLowerCase();
    return documents
      .filter((document) => document.title.toLowerCase().includes(term))
      .map(({ id, title, excerpt }) => ({ id, title, excerpt }));
  },
  getDocument(id) {
    const document = documents.find((item) => item.id === id);
    return document
      ? {
          id: document.id,
          title: document.title,
          content: document.content,
          canonicalUrl: `https://example.com${document.id}`,
        }
      : null;
  },
};
```

`search` returns results containing `id`, `title`, and `excerpt`. It may also include `url` and `section`. `getDocument` returns `id`, `title`, and `content`, or `null` when the document does not exist. `canonicalUrl` and `headings` are optional.

## Navigation pages

Pass a `pages` array to register `list_docs` alongside the search and retrieval tools. Each page needs only an `id` and `title`; `url` and `section` are optional. Agents can list every registered page with `{}` or pass `{ section: "Guide" }` to narrow the result. When `pages` is omitted or empty, only the original two tools are registered.

## Tool results and errors

Both tools return `{ ok: true, data }` on success or `{ ok: false, error }` on failure. There are three error codes:

- `INVALID_INPUT`: The input does not satisfy the schema.
- `NOT_FOUND`: `get_doc` could not find the requested document.
- `PROVIDER_ERROR`: The provider failed or returned invalid data.

Provider exceptions and stack traces are not exposed in tool results.

## Supported environments

In browser environments, `@mcp-b/global` initializes `document.modelContext`, preserving a native WebMCP implementation when available and otherwise installing its polyfill and MCP transports. The library then registers tools through the current WebMCP Imperative API, `document.modelContext.registerTool()`. During server-side rendering it returns `status: "unsupported"` without interfering with the documentation site.

`@mcp-b/global` uses its default transport configuration. To restrict transport origins, set `window.__webModelContextOptions` before calling `registerDocsWebMcp`, following the [`@mcp-b/global` configuration reference](https://docs.mcp-b.ai/packages/global/reference).

WebMCP is experimental, and its browser API may change. This library isolates that API surface behind an adapter typed with `@mcp-b/webmcp-types`.

## Development

Node.js 20 or later and Bun are required.

```sh
bun install
bun run check
```
