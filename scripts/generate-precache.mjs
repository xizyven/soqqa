// Runs after `next build`: lists every hashed static asset so the service
// worker can precache the whole app shell for offline use.
import { readdirSync, statSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const root = ".next/static";
const base = process.env.STATIC_EXPORT === "1" ? (process.env.BASE_PATH ?? "") : "";
if (!existsSync(root)) {
  console.warn("[precache] .next/static not found — skipping");
  process.exit(0);
}
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (!name.endsWith(".map")) files.push(base + "/_next/static/" + relative(root, p).split(sep).join("/"));
  }
})(root);
const build = existsSync(".next/BUILD_ID") ? readFileSync(".next/BUILD_ID", "utf8").trim() : String(Date.now());
const icons = ["/icons/icon.svg", "/icons/icon-192.png", "/icons/icon-512.png", "/manifest.webmanifest"].map((p) => base + p);
writeFileSync("public/precache-manifest.json", JSON.stringify({ build, assets: [...icons, ...files] }));
// Stamp the build id into the service worker so each deploy is a new worker.
const swPath = "public/sw.js";
const sw = readFileSync(swPath, "utf8").replace(/const BUILD = "[^"]*";/, `const BUILD = "${build}";`);
writeFileSync(swPath, sw);
if (process.env.STATIC_EXPORT === "1" && existsSync("out")) {
  writeFileSync("out/sw.js", sw);
  writeFileSync("out/precache-manifest.json", readFileSync("public/precache-manifest.json"));
}
console.log(`[precache] ${files.length} assets (build ${build})`);
