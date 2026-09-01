import type {
  DocsDocument,
  DocsHeading,
  DocsPage,
  DocsSearchResult,
} from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKey(value: Record<string, unknown>, key: string): boolean {
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === key;
}

export function readSingleStringInput(
  input: unknown,
  key: "query" | "id",
): string | null {
  if (!isRecord(input) || !hasOnlyKey(input, key)) {
    return null;
  }

  const value = input[key];
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function readOptionalSectionInput(input: unknown): string | undefined | null {
  if (!isRecord(input)) {
    return null;
  }

  const keys = Object.keys(input);
  if (keys.length === 0) {
    return undefined;
  }
  if (!hasOnlyKey(input, "section")) {
    return null;
  }

  const section = input.section;
  if (typeof section !== "string") {
    return null;
  }
  const normalized = section.trim();
  return normalized.length > 0 ? normalized : null;
}

function readOptionalString(
  value: Record<string, unknown>,
  key: string,
): string | undefined | null {
  if (!(key in value)) {
    return undefined;
  }

  const candidate = value[key];
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : null;
}

function normalizeSearchResult(value: unknown): DocsSearchResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readOptionalString(value, "id");
  const title = readOptionalString(value, "title");
  const excerpt = readOptionalString(value, "excerpt");
  const url = readOptionalString(value, "url");
  const section = readOptionalString(value, "section");

  if (!id || !title || !excerpt || url === null || section === null) {
    return null;
  }

  return {
    id,
    title,
    excerpt,
    ...(url === undefined ? {} : { url }),
    ...(section === undefined ? {} : { section }),
  };
}

export function normalizeSearchResults(
  value: unknown,
): DocsSearchResult[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const results: DocsSearchResult[] = [];
  for (const item of value) {
    const normalized = normalizeSearchResult(item);
    if (normalized === null) {
      return null;
    }
    results.push(normalized);
  }

  return results;
}

function normalizePage(value: unknown): DocsPage | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readOptionalString(value, "id");
  const title = readOptionalString(value, "title");
  const url = readOptionalString(value, "url");
  const section = readOptionalString(value, "section");

  if (!id || !title || url === null || section === null) {
    return null;
  }

  return {
    id,
    title,
    ...(url === undefined ? {} : { url }),
    ...(section === undefined ? {} : { section }),
  };
}

export function normalizePages(value: unknown): DocsPage[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const pages: DocsPage[] = [];
  for (const item of value) {
    const page = normalizePage(item);
    if (page === null) {
      return null;
    }
    pages.push(page);
  }
  return pages;
}

function normalizeHeading(value: unknown): DocsHeading | null {
  if (!isRecord(value)) {
    return null;
  }

  const title = readOptionalString(value, "title");
  const id = readOptionalString(value, "id");
  const level = value.level;

  if (
    !title ||
    id === null ||
    typeof level !== "number" ||
    !Number.isInteger(level) ||
    level < 1 ||
    level > 6
  ) {
    return null;
  }

  return {
    title,
    level,
    ...(id === undefined ? {} : { id }),
  };
}

export function normalizeDocument(value: unknown): DocsDocument | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readOptionalString(value, "id");
  const title = readOptionalString(value, "title");
  const content = readOptionalString(value, "content");
  const canonicalUrl = readOptionalString(value, "canonicalUrl");
  const headingsValue = value.headings;

  if (!id || !title || !content || canonicalUrl === null) {
    return null;
  }

  let headings: DocsHeading[] | undefined;
  if (headingsValue !== undefined) {
    if (!Array.isArray(headingsValue)) {
      return null;
    }

    headings = [];
    for (const heading of headingsValue) {
      const normalized = normalizeHeading(heading);
      if (normalized === null) {
        return null;
      }
      headings.push(normalized);
    }
  }

  return {
    id,
    title,
    content,
    ...(canonicalUrl === undefined ? {} : { canonicalUrl }),
    ...(headings === undefined ? {} : { headings }),
  };
}
