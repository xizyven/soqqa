// Static export only (GitHub Pages): Next.js writes per-segment prefetch data
// as nested folders, e.g. out/transactions/__next.!KGFwcCk/transactions/__PAGE__.txt,
// but the client requests the flat name transactions/__next.!KGFwcCk.transactions.__PAGE__.txt.
// A plain static host can't map one to the other, so write the flat copies too.
import { copyFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = process.argv[2] ?? "out";
if (!existsSync(root)) {
  console.warn(`[flatten] ${root} not found — skipping`);
  process.exit(0);
}

function files(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

let count = 0;
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (!statSync(p).isDirectory() || name === "_next") continue;
    if (name.startsWith("__next.")) {
      for (const f of files(p)) {
        copyFileSync(f, join(dir, name + "." + relative(p, f).split(sep).join(".")));
        count++;
      }
    } else {
      walk(p);
    }
  }
})(root);
console.log(`[flatten] wrote ${count} flat segment files`);
