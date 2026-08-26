# webmcp-docs

[日本語](./README.ja.md)

`webmcp-docs` is a framework-agnostic library that exposes documentation search and retrieval as WebMCP tools. AI agents can use `search_docs` and `get_doc` to access documentation semantically instead of guessing how to operate search forms or navigate the DOM.

## Installation

```sh
bun add webmcp-docs
```

## Minimal setup

```ts
import { registerDocsWebMcp } from "webmcp-docs";

const registration = await registerDocsWebMcp({
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

## Tool results and errors

Both tools return `{ ok: true, data }` on success or `{ ok: false, error }` on failure. There are three error codes:

- `INVALID_INPUT`: The input does not satisfy the schema.
- `NOT_FOUND`: `get_doc` could not find the requested document.
- `PROVIDER_ERROR`: The provider failed or returned invalid data.

Provider exceptions and stack traces are not exposed in tool results.

## Supported environments

In supported browsers, the library uses the current WebMCP Imperative API, `document.modelContext.registerTool()`. In unsupported browsers and during server-side rendering, it returns `status: "unsupported"` without interfering with the documentation site.

WebMCP is experimental, and its browser API may change. This library isolates that API surface behind an internal adapter.

## Development

Node.js 20 or later and Bun are required.

```sh
bun install
bun run check
```

## Publishing

Publishing a non-prerelease GitHub Release automatically publishes the package to npm after running the full check. Update the version in `package.json` first; the release tag must match it using the `vX.Y.Z` format.

Before using the workflow, configure the package's Trusted Publisher on npm with these values:

- Provider: GitHub Actions
- Repository owner: `link1345`
- Repository: `webmcp-docs`
- Workflow filename: `publish.yml`
- Allowed action: `npm publish`

Releases use short-lived OIDC credentials and publish provenance automatically. No npm token or GitHub Actions secret is needed.
