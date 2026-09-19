import {
  DEFAULT_TOKENIZE_MAX_LENGTH,
  getFiletypeFromFileName,
  getSharedHighlighter,
  type FileDiffMetadata,
  type SupportedLanguages,
  type ThemedToken,
} from "@pierre/diffs";

import type { SplitDisplayRow } from "./split-rows";

/**
 * The diff surface renders on a dark terminal background, so it uses the dark
 * theme @pierre/diffs resolves through its shared highlighter.
 */
const SPLIT_THEME = "pierre-dark";

type SplitLineRow = Extract<SplitDisplayRow, { kind: "line" }>;

/**
 * Tokens for one rendered split side, indexed the same way as the line rows
 * passed to `highlightSplitRows`. A side may be absent when it has no code.
 */
export interface SplitTokens {
  readonly left?: readonly (readonly ThemedToken[])[];
  readonly right?: readonly (readonly ThemedToken[])[];
}

function getLineRows(
  rows: readonly SplitDisplayRow[],
): readonly SplitLineRow[] {
  return rows.filter((row): row is SplitLineRow => row.kind === "line");
}

/**
 * Rendered code per side, in row order. Empty entries keep padding rows aligned
 * with their opposite column so token indexes stay in step with the rows.
 */
function sideLines(
  rows: readonly SplitLineRow[],
  side: "left" | "right",
): readonly string[] {
  return rows.map(
    (row) => (side === "left" ? row.left : row.right)?.text ?? "",
  );
}

function hasContent(lines: readonly string[]): boolean {
  return lines.some((line) => line.length > 0);
}

const languageWarmups = new Map<SupportedLanguages, Promise<void>>();

function defer<T>(run: () => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => void run().then(resolve, reject), 0);
  });
}

function warmLanguage(lang: SupportedLanguages): Promise<void> {
  const cached = languageWarmups.get(lang);
  if (cached !== undefined) {
    return cached;
  }

  // Loading a grammar is cheap, but its first tokenization compiles regexes
  // synchronously. Schedule that work outside the selection/rendering turn.
  const pending = defer(async () => {
    const highlighter = await getSharedHighlighter({
      themes: [SPLIT_THEME],
      langs: [lang],
    });
    highlighter.codeToTokens("const value = 0", {
      lang,
      theme: SPLIT_THEME,
    });
  });
  languageWarmups.set(lang, pending);
  pending.catch(() => languageWarmups.delete(lang));
  return pending;
}

async function tokenizeSide(
  lang: SupportedLanguages,
  code: string,
): Promise<readonly (readonly ThemedToken[])[]> {
  await warmLanguage(lang);
  const highlighter = await getSharedHighlighter({
    themes: [SPLIT_THEME],
    langs: [lang],
  });
  // One call per side keeps the grammar state coherent across every rendered
  // line, including multiline strings and block comments.
  return highlighter.codeToTokens(code, { lang, theme: SPLIT_THEME }).tokens;
}

async function tokenizeSplitRows(
  fileDiff: FileDiffMetadata,
  rows: readonly SplitDisplayRow[],
): Promise<SplitTokens | undefined> {
  const lang = fileDiff.lang ?? getFiletypeFromFileName(fileDiff.name);
  if (lang === "text" || lang === "ansi") {
    return undefined;
  }

  const lineRows = getLineRows(rows);
  const left = sideLines(lineRows, "left");
  const right = sideLines(lineRows, "right");
  if (!hasContent(left) && !hasContent(right)) {
    return undefined;
  }

  const leftCode = left.join("\n");
  const rightCode = right.join("\n");
  const tooLong = (code: string) => code.length > DEFAULT_TOKENIZE_MAX_LENGTH;
  if (tooLong(leftCode) || tooLong(rightCode)) {
    return undefined;
  }

  const [leftTokens, rightTokens] = await Promise.all([
    hasContent(left) ? tokenizeSide(lang, leftCode) : undefined,
    hasContent(right) ? tokenizeSide(lang, rightCode) : undefined,
  ]);
  return { left: leftTokens, right: rightTokens };
}

const highlightCache = new WeakMap<
  FileDiffMetadata,
  Promise<SplitTokens | undefined>
>();

/** Warm each language in an available patch before the user opens a file. */
export function prewarmSplitHighlights(
  fileDiffs: readonly FileDiffMetadata[],
): void {
  const languages = new Set<SupportedLanguages>();
  for (const fileDiff of fileDiffs) {
    const lang = fileDiff.lang ?? getFiletypeFromFileName(fileDiff.name);
    if (lang !== "text" && lang !== "ansi") {
      languages.add(lang);
    }
  }
  for (const lang of languages) {
    void warmLanguage(lang).catch(() => undefined);
  }
}

/**
 * Highlights both split sides, reusing the pending or resolved result for the
 * same file identity. Oversized input resolves to `undefined`, and a failed
 * highlighter rejects and is evicted so a later mount can retry; either case
 * renders as plain text.
 */
export function highlightSplitRows(
  fileDiff: FileDiffMetadata,
  rows: readonly SplitDisplayRow[],
): Promise<SplitTokens | undefined> {
  const cached = highlightCache.get(fileDiff);
  if (cached !== undefined) {
    return cached;
  }
  // Plain diff rows can paint before tokenization starts, even if prewarming
  // has not finished yet.
  const pending = defer(() => tokenizeSplitRows(fileDiff, rows));
  highlightCache.set(fileDiff, pending);
  pending.catch(() => {
    if (highlightCache.get(fileDiff) === pending) {
      highlightCache.delete(fileDiff);
    }
  });
  return pending;
}
