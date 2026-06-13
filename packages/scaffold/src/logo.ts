// ANSI-Shadow "INDAGO" banner printed at the top of the CLI.
export const LOGO_LINES = [
  "██╗███╗   ██╗██████╗  █████╗  ██████╗  ██████╗ ",
  "██║████╗  ██║██╔══██╗██╔══██╗██╔════╝ ██╔═══██╗",
  "██║██╔██╗ ██║██║  ██║███████║██║  ███╗██║   ██║",
  "██║██║╚██╗██║██║  ██║██╔══██║██║   ██║██║   ██║",
  "██║██║ ╚████║██████╔╝██║  ██║╚██████╔╝╚██████╔╝",
  "╚═╝╚═╝  ╚═══╝╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ",
];

const RESET = "\x1b[0m";

// 24-bit truecolor gradient across the two brand colors of the Indago logo
// (assets/logo.svg): the terracotta mark #BB795A on top — the color you read as
// "the logo" — fading down into the plum #290C29 base. The plum end is lifted to
// #43254A so every banner line stays legible on a dark terminal.
const GRADIENT: ReadonlyArray<readonly [number, number, number]> = [
  [187, 121, 90], // Step 1: #BB795A — brand terracotta (logo mark)
  [176, 112, 92], // Step 2: #B0705C
  [154, 94, 90], // Step 3: #9A5E5A
  [126, 76, 86], // Step 4: #7E4C56
  [92, 52, 80], // Step 5: #5C3450
  [67, 37, 74], // Step 6: #43254A — brand plum #290C29, lifted for legibility
];

const colorsEnabled = (): boolean =>
  Boolean(process.stdout.isTTY) &&
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== "dumb";

/** Render the banner as a single string (used by tests and the CLI). */
export function renderLogo(): string {
  if (!colorsEnabled()) return LOGO_LINES.join("\n");

  return LOGO_LINES.map((line, i) => {
    const [r, g, b] = GRADIENT[i % GRADIENT.length] ?? GRADIENT[0];
    return `\x1b[38;2;${r};${g};${b}m${line}${RESET}`;
  }).join("\n");
}

/** Print the banner plus a one-line tagline to stdout. */
export function printLogo(): void {
  process.stdout.write(`\n${renderLogo()}\n`);
  const tagline =
    "  Markdown → FTS in SQLite (HyperDown) · JSON Data + Schema → TS types  (HyperJson)";
  process.stdout.write(colorsEnabled() ? `\x1b[2m${tagline}${RESET}\n\n` : `${tagline}\n\n`);
}
