export interface WebMcpTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    untrustedContentHint: boolean;
  };
  execute(input: object): Promise<unknown>;
}

interface WebMcpModelContext {
  registerTool(
    tool: WebMcpTool,
    options?: { signal?: AbortSignal },
  ): void | PromiseLike<void>;
}

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

export function getWebMcpTarget(): WebMcpTargetResult {
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
  await target.registerTool.call(target.receiver, tool, { signal });
}
