// WCAG 2.x contrast for the pairs make-it-yours requires. Part of the
// design-direction skill; adds nothing to the app. Usage, from the repo root:
//   bun run .agents/skills/design-direction/contrast.ts '#c2410c' '#ffffff'
//     -> prints the ratio
//   bun run .agents/skills/design-direction/contrast.ts --sheet docs/brand-direction.md
//     -> checks every row of the sheet's contrast table and exits 1 on a FAIL
type Rgb = [number, number, number];
// A color is #rgb, #rrggbb, or rgba(r, g, b, a). An rgba() foreground is
// composited over the background first (the token files use rgba borders).
function parse(color: string, over?: Rgb): Rgb {
  const s = color.trim();
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)$/.exec(s);
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map(Number) as Rgb;
    const a = m[4] === undefined ? 1 : Number(m[4]);
    if (a === 1 || !over) return [r, g, b];
    return [r, g, b].map((c, i) => Math.round(c * a + over[i] * (1 - a))) as Rgb;
  }
  const h = s.replace(/^#/, '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a hex or rgba() color: ${color}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
}
function linear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function lum([r, g, b]: Rgb): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}
export function ratio(fg: string, bg: string): number {
  const back = parse(bg);
  const [l1, l2] = [lum(parse(fg, back)), lum(back)].toSorted((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
const args = process.argv.slice(2);
if (args[0] === '--sheet') {
  const text = await Bun.file(args[1]).text();
  // Rows: | <pair name> | light|dark | <fg color> | <bg color> | <min ratio> |
  const rows = [...text.matchAll(/^\|\s*([^|]+?)\s*\|\s*(light|dark)\s*\|\s*(#[0-9a-fA-F]{3,6}|rgba?\([^)]*\))\s*\|\s*(#[0-9a-fA-F]{3,6})\s*\|\s*([0-9.]+)\s*\|/gm)];
  if (rows.length === 0) { console.error('no contrast rows found: | name | light or dark | fg | bg | min |'); process.exit(1); }
  let failed = 0;
  for (const [, name, mode, fg, bg, min] of rows) {
    const r = ratio(fg, bg);
    const ok = r >= Number(min);
    if (!ok) failed++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} (${mode}): ${fg} on ${bg} = ${r.toFixed(2)}:1 (min ${min}:1)`);
  }
  process.exit(failed ? 1 : 0);
} else if (args.length === 2) {
  console.log(`${ratio(args[0], args[1]).toFixed(2)}:1`);
} else {
  console.error('usage: bun run contrast.ts <#fg> <#bg> | --sheet <file>');
  process.exit(2);
}
