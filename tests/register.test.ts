import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { registerDocsWebMcp } from "../src/index.js";
import type { DocsProvider } from "../src/index.js";
import type { WebMcpTool } from "../src/webmcp-adapter.js";

const originalDocumentDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "document",
);

function setDocument(value: unknown): void {
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    writable: true,
    value,
  });
}

function createProvider(overrides: Partial<DocsProvider> = {}): DocsProvider {
  return {
    search: vi.fn(() => []),
    getDocument: vi.fn(() => null),
    ...overrides,
  };
}

function createSupportedDocument(options?: {
  failOn?: string;
  beforeRegister?: (tool: WebMcpTool) => void | Promise<void>;
}) {
  const tools: WebMcpTool[] = [];
  const signals: AbortSignal[] = [];
  const modelContext = {
    async registerTool(
      tool: WebMcpTool,
      registrationOptions?: { signal?: AbortSignal },
    ) {
      await options?.beforeRegister?.(tool);
      if (tool.name === options?.failOn) {
        throw new DOMException("Registration rejected", "NotAllowedError");
      }
      tools.push(tool);
      if (registrationOptions?.signal) {
        signals.push(registrationOptions.signal);
      }
    },
  };

  return { document: { modelContext }, modelContext, tools, signals };
}

function getTool(tools: WebMcpTool[], name: string): WebMcpTool {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Tool ${name} was not registered.`);
  }
  return tool;
}

beforeEach(() => {
  setDocument(undefined);
});

afterAll(() => {
  if (originalDocumentDescriptor) {
    Object.defineProperty(globalThis, "document", originalDocumentDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "document");
  }
});

describe("feature detection", () => {
  it.each([
    ["document is absent", undefined],
    ["modelContext is absent", {}],
    ["registerTool is absent", { modelContext: {} }],
  ])("returns unsupported when %s", async (_label, documentValue) => {
    setDocument(documentValue);

    const result = await registerDocsWebMcp({ provider: createProvider() });

    expect(result.status).toBe("unsupported");
    expect(() => result.unregister()).not.toThrow();
  });

  it("contains modelContext access failures", async () => {
    setDocument({
      get modelContext() {
        throw new DOMException("Blocked", "SecurityError");
      },
    });

    const result = await registerDocsWebMcp({ provider: createProvider() });

    expect(result).toMatchObject({
      status: "failed",
      error: { code: "REGISTRATION_FAILED" },
    });
  });
});

describe("registration", () => {
  it("registers both read-only tools with strict schemas", async () => {
    const supported = createSupportedDocument();
    setDocument(supported.document);

    const result = await registerDocsWebMcp({ provider: createProvider() });

    expect(result.status).toBe("registered");
    expect(supported.tools.map((tool) => tool.name)).toEqual([
      "search_docs",
      "get_doc",
    ]);
    for (const tool of supported.tools) {
      expect(tool.annotations).toEqual({
        readOnlyHint: true,
        untrustedContentHint: true,
      });
      expect(tool.inputSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
      });
    }
    expect(supported.signals).toHaveLength(2);
    expect(supported.signals[0]).toBe(supported.signals[1]);
  });

  it("returns the same handle for sequential duplicate calls", async () => {
    const supported = createSupportedDocument();
    setDocument(supported.document);
    const firstProvider = createProvider();

    const first = await registerDocsWebMcp({ provider: firstProvider });
    const second = await registerDocsWebMcp({ provider: createProvider() });

    expect(second).toBe(first);
    expect(supported.tools).toHaveLength(2);
  });

  it("deduplicates concurrent registration", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let firstCall = true;
    const supported = createSupportedDocument({
      beforeRegister: async () => {
        if (firstCall) {
          firstCall = false;
          await gate;
        }
      },
    });
    setDocument(supported.document);

    const firstPending = registerDocsWebMcp({ provider: createProvider() });
    const secondPending = registerDocsWebMcp({ provider: createProvider() });
    release();

    const [first, second] = await Promise.all([firstPending, secondPending]);
    expect(second).toBe(first);
    expect(supported.tools).toHaveLength(2);
  });

  it("aborts partial registration and allows a retry", async () => {
    const supported = createSupportedDocument({ failOn: "get_doc" });
    setDocument(supported.document);

    const failed = await registerDocsWebMcp({ provider: createProvider() });

    expect(failed).toMatchObject({ status: "failed" });
    expect(supported.tools).toHaveLength(1);
    expect(supported.signals[0]?.aborted).toBe(true);

    const retry = createSupportedDocument();
    setDocument(retry.document);
    const registered = await registerDocsWebMcp({ provider: createProvider() });
    expect(registered.status).toBe("registered");
  });

  it("unregisters once and permits a new provider", async () => {
    const supported = createSupportedDocument();
    setDocument(supported.document);

    const first = await registerDocsWebMcp({ provider: createProvider() });
    first.unregister();
    first.unregister();
    expect(supported.signals.every((signal) => signal.aborted)).toBe(true);

    const second = await registerDocsWebMcp({ provider: createProvider() });
    expect(second).not.toBe(first);
    expect(supported.tools).toHaveLength(4);
  });

  it("returns failed for an invalid provider", async () => {
    const supported = createSupportedDocument();
    setDocument(supported.document);

    const result = await registerDocsWebMcp({
      provider: {} as DocsProvider,
    });

    expect(result.status).toBe("failed");
    expect(supported.tools).toHaveLength(0);
  });
});

describe("tool execution", () => {
  it("normalizes a query and delegates search", async () => {
    const search = vi.fn(() => [
      {
        id: "/guide",
        title: "Guide",
        excerpt: "Start here",
        url: "https://example.com/guide",
        ignored: "not exposed",
      },
    ]);
    const supported = createSupportedDocument();
    setDocument(supported.document);
    await registerDocsWebMcp({
      provider: createProvider({ search }),
    });

    const result = await getTool(supported.tools, "search_docs").execute({
      query: "  WebMCP  ",
    });

    expect(search).toHaveBeenCalledWith("WebMCP");
    expect(result).toEqual({
      ok: true,
      data: {
        results: [
          {
            id: "/guide",
            title: "Guide",
            excerpt: "Start here",
            url: "https://example.com/guide",
          },
        ],
      },
    });
  });

  it.each([
    null,
    {},
    { query: " " },
    { query: "docs", extra: true },
    { query: 42 },
  ])("rejects invalid search input %#", async (input) => {
    const search = vi.fn(() => []);
    const supported = createSupportedDocument();
    setDocument(supported.document);
    await registerDocsWebMcp({ provider: createProvider({ search }) });

    const result = await getTool(supported.tools, "search_docs").execute(
      input as Record<string, unknown>,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
    expect(search).not.toHaveBeenCalled();
  });

  it("retrieves and normalizes a document", async () => {
    const getDocument = vi.fn(() => ({
      id: "/guide",
      title: "Guide",
      content: "# Guide",
      canonicalUrl: "https://example.com/guide",
      headings: [{ title: "Guide", level: 1, id: "guide" }],
      ignored: true,
    }));
    const supported = createSupportedDocument();
    setDocument(supported.document);
    await registerDocsWebMcp({
      provider: createProvider({ getDocument }),
    });

    const result = await getTool(supported.tools, "get_doc").execute({
      id: "  /guide  ",
    });

    expect(getDocument).toHaveBeenCalledWith("/guide");
    expect(result).toEqual({
      ok: true,
      data: {
        document: {
          id: "/guide",
          title: "Guide",
          content: "# Guide",
          canonicalUrl: "https://example.com/guide",
          headings: [{ title: "Guide", level: 1, id: "guide" }],
        },
      },
    });
  });

  it("returns NOT_FOUND when the provider returns null", async () => {
    const supported = createSupportedDocument();
    setDocument(supported.document);
    await registerDocsWebMcp({ provider: createProvider() });

    const result = await getTool(supported.tools, "get_doc").execute({
      id: "/missing",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: 'No document was found for id "/missing".',
      },
    });
  });

  it.each([
    ["search throws", "search_docs", createProvider({ search: () => { throw new Error("secret"); } }), { query: "docs" }],
    ["search output is invalid", "search_docs", createProvider({ search: () => [{ id: "/bad" }] as never }), { query: "docs" }],
    ["get throws", "get_doc", createProvider({ getDocument: () => { throw new Error("secret"); } }), { id: "/guide" }],
    ["get output is invalid", "get_doc", createProvider({ getDocument: () => ({ id: "/bad" }) as never }), { id: "/bad" }],
  ])("returns a safe provider error when %s", async (_label, toolName, provider, input) => {
    const supported = createSupportedDocument();
    setDocument(supported.document);
    await registerDocsWebMcp({ provider });

    const result = await getTool(supported.tools, toolName).execute(input);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "PROVIDER_ERROR" },
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
