export type Awaitable<T> = T | PromiseLike<T>;

export interface DocsSearchResult {
  id: string;
  title: string;
  excerpt: string;
  url?: string;
  section?: string;
}

export interface DocsHeading {
  title: string;
  level: number;
  id?: string;
}

export interface DocsDocument {
  id: string;
  title: string;
  content: string;
  canonicalUrl?: string;
  headings?: readonly DocsHeading[];
}

export interface DocsProvider {
  search(query: string): Awaitable<readonly DocsSearchResult[]>;
  getDocument(id: string): Awaitable<DocsDocument | null>;
}

export interface RegisterDocsWebMcpOptions {
  provider: DocsProvider;
}

export type DocsToolErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "PROVIDER_ERROR";

export interface DocsToolError {
  code: DocsToolErrorCode;
  message: string;
}

export type DocsToolResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: DocsToolError };

export interface SearchDocsData {
  results: DocsSearchResult[];
}

export interface GetDocData {
  document: DocsDocument;
}

export interface RegisteredDocsWebMcp {
  status: "registered";
  unregister(): void;
}

export interface UnsupportedDocsWebMcp {
  status: "unsupported";
  unregister(): void;
}

export interface FailedDocsWebMcp {
  status: "failed";
  error: {
    code: "REGISTRATION_FAILED";
    message: string;
  };
  unregister(): void;
}

export type DocsWebMcpRegistration =
  | RegisteredDocsWebMcp
  | UnsupportedDocsWebMcp
  | FailedDocsWebMcp;
