import type {
  InputSchema,
  ModelContext,
  ModelContextTool,
  WebMcpToolInput,
} from "@mcp-b/webmcp-types";

export type WebMcpTool = ModelContextTool<
  WebMcpToolInput,
  unknown
> & {
  title: string;
  inputSchema: InputSchema;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: boolean;
  };
};

type WebMcpModelContext = Pick<ModelContext, "registerTool">;

export type WebMcpTargetResult =
  | {
      status: "supported";
      documentKey: object;
      registerTool: WebMcpModelContext["registerTool"];
      receiver: WebMcpModelContext;
    }
  | { status: "unsupported" }
  | { status: "failed" };

function hasRegisterTool(value: unknown): value is WebMcpModelContext {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return (
    "registerTool" in value &&
    typeof (value as { registerTool?: unknown }).registerTool === "function"
  );
}

export async function getWebMcpTarget(): Promise<WebMcpTargetResult> {
  try {
    // @mcp-b/global is idempotent. It preserves native WebMCP when available and
    // installs the polyfill plus MCP transports in other supported browsers.
    const { initializeWebModelContext } = await import("@mcp-b/global");
    initializeWebModelContext();
  } catch {
    return { status: "failed" };
  }

  let documentValue: unknown;

  try {
    documentValue = globalThis.document;
  } catch {
    return { status: "failed" };
  }

  if (typeof documentValue !== "object" || documentValue === null) {
    return { status: "unsupported" };
  }

  let modelContext: unknown;
  try {
    modelContext = (documentValue as { modelContext?: unknown }).modelContext;
  } catch {
    return { status: "failed" };
  }

  if (!hasRegisterTool(modelContext)) {
    return { status: "unsupported" };
  }

  return {
    status: "supported",
    documentKey: documentValue,
    registerTool: modelContext.registerTool,
    receiver: modelContext,
  };
}

export async function registerWebMcpTool(
  target: Extract<WebMcpTargetResult, { status: "supported" }>,
  tool: WebMcpTool,
  signal: AbortSignal,
): Promise<void> {
  await Reflect.apply(target.registerTool, target.receiver, [tool, { signal }]);
}
