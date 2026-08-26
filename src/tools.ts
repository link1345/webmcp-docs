import type {
  DocsProvider,
  DocsToolResult,
  GetDocData,
  SearchDocsData,
} from "./types.js";
import { normalizeDocument, normalizeSearchResults, readSingleStringInput } from "./validation.js";
import type { WebMcpTool } from "./webmcp-adapter.js";

const annotations = {
  readOnlyHint: true,
  untrustedContentHint: true,
} as const;

const searchInputSchema = {
  type: "object",
  properties: {
    query: {
      type: "string",
      minLength: 1,
      description: "Words or a phrase to search for in the documentation.",
    },
  },
  required: ["query"],
  additionalProperties: false,
} as const;

const getDocInputSchema = {
  type: "object",
  properties: {
    id: {
      type: "string",
      minLength: 1,
      description: "The document ID or URL returned by search_docs.",
    },
  },
  required: ["id"],
  additionalProperties: false,
} as const;

function invalidInput<T>(key: "query" | "id"): DocsToolResult<T> {
  return {
    ok: false,
    error: {
      code: "INVALID_INPUT",
      message: `Expected an object containing only a non-empty string \"${key}\".`,
    },
  };
}

async function searchDocs(
  provider: DocsProvider,
  input: unknown,
): Promise<DocsToolResult<SearchDocsData>> {
  const query = readSingleStringInput(input, "query");
  if (query === null) {
    return invalidInput("query");
  }

  try {
    const results = normalizeSearchResults(await provider.search(query));
    if (results === null) {
      throw new TypeError("Invalid search result returned by provider.");
    }
    return { ok: true, data: { results } };
  } catch {
    return {
      ok: false,
      error: {
        code: "PROVIDER_ERROR",
        message: "The documentation provider failed to search documents.",
      },
    };
  }
}

async function getDoc(
  provider: DocsProvider,
  input: unknown,
): Promise<DocsToolResult<GetDocData>> {
  const id = readSingleStringInput(input, "id");
  if (id === null) {
    return invalidInput("id");
  }

  try {
    const value = await provider.getDocument(id);
    if (value === null) {
      return {
        ok: false,
        error: {
          code: "NOT_FOUND",
          message: `No document was found for id \"${id}\".`,
        },
      };
    }

    const document = normalizeDocument(value);
    if (document === null) {
      throw new TypeError("Invalid document returned by provider.");
    }
    return { ok: true, data: { document } };
  } catch {
    return {
      ok: false,
      error: {
        code: "PROVIDER_ERROR",
        message: "The documentation provider failed to retrieve the document.",
      },
    };
  }
}

export function createDocsTools(provider: DocsProvider): readonly WebMcpTool[] {
  return [
    {
      name: "search_docs",
      title: "Search documentation",
      description: "Search the site's documentation for relevant pages and sections.",
      inputSchema: searchInputSchema,
      annotations,
      execute: (input) => searchDocs(provider, input),
    },
    {
      name: "get_doc",
      title: "Get documentation page",
      description: "Retrieve a complete documentation page by its ID or URL.",
      inputSchema: getDocInputSchema,
      annotations,
      execute: (input) => getDoc(provider, input),
    },
  ];
}
