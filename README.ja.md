# webmcp-docs

[English](./README.md)

**webmcp-docs:** [![NPM Version](https://img.shields.io/npm/v/webmcp-docs)](https://www.npmjs.com/package/webmcp-docs) ![NPM Downloads](https://img.shields.io/npm/dw/webmcp-docs)<br>

`webmcp-docs` は、ドキュメントサイトの検索とページ取得を WebMCP ツールとして公開する、フレームワーク非依存のライブラリです。AI エージェントは検索フォームや DOM 構造を推測せず、`search_docs` と `get_doc` を使って意味ベースでドキュメントを参照できます。ナビゲーション用ページを登録すると、`list_docs` で同じセクションを含む他のページも公開できます。`@mcp-b/global` により WebMCP polyfill と MCP transport を提供しつつ、ブラウザのネイティブ実装にも対応します。

このパッケージを使って構成した[実例](https://webmcp.ora.ai/gua.orizika.com)では、`webmcp.ora.ai` で100点を達成しています。

## インストール

```sh
bun add webmcp-docs
```

## 最小導入例

```ts
import { registerDocsWebMcp } from "webmcp-docs";

const registration = await registerDocsWebMcp({
  pages: [
    { id: "/guide/getting-started", title: "はじめに", section: "ガイド" },
    { id: "/guide/configuration", title: "設定", section: "ガイド" },
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

`search` は `id`、`title`、`excerpt` を持つ結果を返す。`url` と `section` も任意で追加できる。`getDocument` は `id`、`title`、`content` を返し、文書がなければ `null` を返す。`canonicalUrl` と `headings` は任意です。

## ナビゲーション用ページ

`pages` 配列を渡すと、検索・取得ツールに加えて `list_docs` を登録する。各ページで必須なのは `id` と `title` だけで、`url` と `section` は任意です。エージェントは `{}` ですべての登録ページを取得でき、`{ section: "ガイド" }` のようにセクションで絞り込める。`pages` を省略するか空配列にした場合は、従来どおり2ツールだけを登録する。

## ツール結果とエラー

両ツールは、成功時に `{ ok: true, data }`、失敗時に `{ ok: false, error }` を返す。エラーコードは次の3種類です。

- `INVALID_INPUT`: 入力が schema を満たさない
- `NOT_FOUND`: `get_doc` で文書が存在しない
- `PROVIDER_ERROR`: Provider が失敗した、または不正なデータを返した

Provider の例外や stack trace はツール結果へ公開しない。

## 対応環境

ブラウザ環境では `@mcp-b/global` が `document.modelContext` を初期化します。ネイティブ WebMCP 実装があればそれを維持し、それ以外では polyfill と MCP transport を導入します。その後、現在の WebMCP Imperative API である `document.modelContext.registerTool()` を通じてツールを登録します。SSR では `status: "unsupported"` を返し、通常のドキュメントサイトの動作を妨げません。

`@mcp-b/global` の transport はデフォルト設定を利用します。接続元originを制限する場合は、`registerDocsWebMcp` を呼び出す前に `window.__webModelContextOptions` を設定します。詳細は [`@mcp-b/global` の設定リファレンス](https://docs.mcp-b.ai/packages/global/reference) を参照してください。

WebMCP は実験的な仕様であり、ブラウザ API は今後変更される可能性があります。本ライブラリでは、その API surface を `@mcp-b/webmcp-types` で型付けしたアダプターへ隔離しています。

## 開発

Node.js 20 以上と Bun が必要です。

```sh
bun install
bun run check
```

### Astroサンプル

リポジトリをcloneした状態で依存関係を導入し、最小のAstroサイトを起動できます。

```sh
bun install
bun run example:dev
```

ブラウザで `http://127.0.0.1:4321` を開くと、固定のProviderを使って
`search_docs` と `get_doc` をWebMCPへ登録します。サンプルの本体は
[`examples/astro/src/pages/index.astro`](./examples/astro/src/pages/index.astro) です。
