// ANSI-Shadow "MUTTUM" banner printed at the top of the CLI.
export const LOGO_LINES = [
  "███╗   ███╗██╗   ██╗████████╗████████╗██╗   ██╗███╗   ███╗",
  "████╗ ████║██║   ██║╚══██╔══╝╚══██╔══╝██║   ██║████╗ ████║",
  "██╔████╔██║██║   ██║   ██║      ██║   ██║   ██║██╔████╔██║",
  "██║╚██╔╝██║██║   ██║   ██║      ██║   ██║   ██║██║╚██╔╝██║",
  "██║ ╚═╝ ██║╚██████╔╝   ██║      ██║   ╚██████╔╝██║ ╚═╝ ██║",
  "╚═╝     ╚═╝ ╚═════╝    ╚═╝      ╚═╝    ╚═════╝ ╚═╝     ╚═╝",
];

const RESET = "\x1b[0m";

// 24-bit truecolor gradient (cyan → violet) applied per line.
const GRADIENT: ReadonlyArray<readonly [number, number, number]> = [
  [34, 211, 238],
  [56, 189, 248],
  [96, 165, 250],
  [129, 140, 248],
  [167, 139, 250],
  [192, 132, 252],
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
