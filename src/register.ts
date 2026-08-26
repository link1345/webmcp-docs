import { createDocsTools } from "./tools.js";
import type {
  DocsProvider,
  DocsWebMcpRegistration,
  FailedDocsWebMcp,
  RegisterDocsWebMcpOptions,
  UnsupportedDocsWebMcp,
} from "./types.js";
import { getWebMcpTarget, registerWebMcpTool } from "./webmcp-adapter.js";

const registrations = new WeakMap<object, Promise<DocsWebMcpRegistration>>();

const unsupportedRegistration: UnsupportedDocsWebMcp = {
  status: "unsupported",
  unregister() {},
};

function failedRegistration(): FailedDocsWebMcp {
  return {
    status: "failed",
    error: {
      code: "REGISTRATION_FAILED",
      message: "WebMCP tool registration failed.",
    },
    unregister() {},
  };
}

function isProvider(value: unknown): value is DocsProvider {
  return (
    typeof value === "object" &&
    value !== null &&
    "search" in value &&
    typeof (value as { search?: unknown }).search === "function" &&
    "getDocument" in value &&
    typeof (value as { getDocument?: unknown }).getDocument === "function"
  );
}

export async function registerDocsWebMcp(
  options: RegisterDocsWebMcpOptions,
): Promise<DocsWebMcpRegistration> {
  if (
    typeof options !== "object" ||
    options === null ||
    !isProvider((options as { provider?: unknown }).provider)
  ) {
    return failedRegistration();
  }

  const target = await getWebMcpTarget();
  if (target.status === "unsupported") {
    return unsupportedRegistration;
  }
  if (target.status === "failed") {
    return failedRegistration();
  }

  const existing = registrations.get(target.documentKey);
  if (existing !== undefined) {
    return existing;
  }

  let pending!: Promise<DocsWebMcpRegistration>;
  pending = (async () => {
    const controller = new AbortController();

    try {
      for (const tool of createDocsTools(options.provider)) {
        await registerWebMcpTool(target, tool, controller.signal);
      }

      let active = true;
      return {
        status: "registered" as const,
        unregister() {
          if (!active) {
            return;
          }
          active = false;
          controller.abort();
          if (registrations.get(target.documentKey) === pending) {
            registrations.delete(target.documentKey);
          }
        },
      };
    } catch {
      controller.abort();
      if (registrations.get(target.documentKey) === pending) {
        registrations.delete(target.documentKey);
      }
      return failedRegistration();
    }
  })();

  registrations.set(target.documentKey, pending);
  return pending;
}
