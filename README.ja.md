# webmcp-docs

[English](./README.md)

`webmcp-docs` は、ドキュメントサイトの検索とページ取得を WebMCP ツールとして公開する、フレームワーク非依存のライブラリだ。AI エージェントは検索フォームや DOM 構造を推測せず、`search_docs` と `get_doc` を使って意味ベースでドキュメントを参照できる。

## インストール

```sh
bun add webmcp-docs
```

## 最小導入例

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

// SPA のアンマウント時などに登録を解除できる。
registration.unregister();
```

同じ `document` で複数回呼び出した場合は既存の登録ハンドルを返す。Provider を変更する場合は、先に `unregister()` を呼んでから再登録する。

## Provider 契約

Provider はサイトが既に持つ静的 JSON、検索 index、Markdown のビルド済みデータなどへ接続する。

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

`search` は `id`、`title`、`excerpt` を持つ結果を返す。`url` と `section` も任意で追加できる。`getDocument` は `id`、`title`、`content` を返し、文書がなければ `null` を返す。`canonicalUrl` と `headings` は任意だ。

## ツール結果とエラー

両ツールは、成功時に `{ ok: true, data }`、失敗時に `{ ok: false, error }` を返す。エラーコードは次の3種類だ。

- `INVALID_INPUT`: 入力が schema を満たさない
- `NOT_FOUND`: `get_doc` で文書が存在しない
- `PROVIDER_ERROR`: Provider が失敗した、または不正なデータを返した

Provider の例外や stack trace はツール結果へ公開しない。

## 対応環境

対応ブラウザでは、現在の WebMCP Imperative API である `document.modelContext.registerTool()` を利用する。非対応ブラウザや SSR では `status: "unsupported"` を返し、通常のドキュメントサイトの動作を妨げない。

WebMCP は実験的な仕様であり、ブラウザ API は今後変更される可能性がある。本ライブラリでは、その API surface を内部アダプターへ隔離している。

## 開発

Node.js 20 以上と Bun が必要だ。

```sh
bun install
bun run check
```
