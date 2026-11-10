// Rasterises the Soqqa mark (src/components/brand/mark.json) into PWA icons
// without external dependencies: path flattening + supersampled coverage.
import { deflateSync } from "node:zlib";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const mark = JSON.parse(readFileSync("src/components/brand/mark.json", "utf8"));

// ---------------------------------------------------------------- PNG
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ---------------------------------------------------------------- geometry
function flatten(d) {
  const t = d.match(/[MLQZ]|-?\d*\.?\d+/g);
  const pts = [];
  let i = 0, cx = 0, cy = 0, cmd = "";
  while (i < t.length) {
    if (/[MLQZ]/.test(t[i])) cmd = t[i++];
    if (cmd === "Z") continue;
    if (cmd === "M" || cmd === "L") { cx = +t[i++]; cy = +t[i++]; pts.push([cx, cy]); }
    else if (cmd === "Q") {
      const qx = +t[i++], qy = +t[i++], x = +t[i++], y = +t[i++];
      for (let s = 1; s <= 12; s++) { const u = s / 12; pts.push([(1 - u) ** 2 * cx + 2 * (1 - u) * u * qx + u * u * x, (1 - u) ** 2 * cy + 2 * (1 - u) * u * qy + u * u * y]); }
      cx = x; cy = y;
    }
  }
  return pts;
}
function inside(pts, x, y) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const hex = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
function gradColor(g, bbox, x, y) {
  const [x0, y0, x1, y1] = bbox;
  const ax = x0 + g.from[0] * (x1 - x0), ay = y0 + g.from[1] * (y1 - y0);
  const bx = x0 + g.to[0] * (x1 - x0), by = y0 + g.to[1] * (y1 - y0);
  const vx = bx - ax, vy = by - ay;
  let u = ((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1);
  u = Math.max(0, Math.min(1, u));
  const st = g.stops;
  for (let k = 0; k < st.length - 1; k++) {
    if (u <= st[k + 1][0]) {
      const f = (u - st[k][0]) / (st[k + 1][0] - st[k][0] || 1);
      const a = hex(st[k][1]), b = hex(st[k + 1][1]);
      const oa = st[k][2] ?? 1, ob = st[k + 1][2] ?? 1;
      return [...a.map((v, i) => v + (b[i] - v) * f), oa + (ob - oa) * f];
    }
  }
  const last = st[st.length - 1];
  return [...hex(last[1]), last[2] ?? 1];
}
const layers = mark.layers.map((l) => {
  const pts = flatten(l.d);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { ...l, pts, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
});
const chip = flatten(mark.chip.d);
function segDist(px, py, [ax, ay], [bx, by]) {
  const vx = bx - ax, vy = by - ay;
  const u = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - ax - u * vx, py - ay - u * vy);
}
// colour of the mark at a point in mark space, composited over bg
function sampleMark(x, y, bg) {
  let c = [...bg];
  const over = (rgb, a) => { c = [c[0] + (rgb[0] - c[0]) * a, c[1] + (rgb[1] - c[1]) * a, c[2] + (rgb[2] - c[2]) * a, Math.max(c[3], a)]; };
  for (const l of layers) {
    if (!inside(l.pts, x, y)) continue;
    if (l.fill.startsWith("#")) over(hex(l.fill), l.opacity ?? 1);
    else { const g = gradColor(mark.gradients[l.fill], l.bbox, x, y); over(g.slice(0, 3), g[3] * (l.opacity ?? 1)); }
  }
  if (segDist(x, y, mark.stripe.from, mark.stripe.to) <= mark.stripe.width / 2) over(hex(mark.stripe.color), mark.stripe.opacity ?? 1);
  if (inside(chip, x, y)) over(hex(mark.chip.color), 1);
  return c;
}

// ---------------------------------------------------------------- render
function render(size, { bg, radius = 0.225, markScale = 0.6 }) {
  const out = Buffer.alloc(size * size * 4);
  const [mw, mh] = mark.viewBox;
  const s = (size * markScale) / Math.max(mw, mh);
  const ox = (size - mw * s) / 2, oy = (size - mh * s) / 2;
  const ss = 4;
  const r = radius * size;
  const bgc = bg ? [...hex(bg), 1] : [0, 0, 0, 0];
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let acc = [0, 0, 0, 0];
    for (let i = 0; i < ss; i++) for (let j = 0; j < ss; j++) {
      const x = px + (i + 0.5) / ss, y = py + (j + 0.5) / ss;
      // rounded-square tile mask
      const qx = Math.max(Math.abs(x - size / 2) - (size / 2 - r), 0), qy = Math.max(Math.abs(y - size / 2) - (size / 2 - r), 0);
      const inTile = !bg || radius === 0 || Math.hypot(qx, qy) <= r;
      let c = inTile ? [...bgc] : [0, 0, 0, 0];
      if (inTile || !bg) c = sampleMark((x - ox) / s, (y - oy) / s, c);
      acc = [acc[0] + c[0] * c[3], acc[1] + c[1] * c[3], acc[2] + c[2] * c[3], acc[3] + c[3]];
    }
    const a = acc[3] / (ss * ss);
    const o = (py * size + px) * 4;
    if (a > 0) { out[o] = acc[0] / acc[3]; out[o + 1] = acc[1] / acc[3]; out[o + 2] = acc[2] / acc[3]; out[o + 3] = Math.round(a * 255); }
  }
  return png(size, out);
}

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/icons/icon-192.png", render(192, { bg: "#FFFFFF" }));
writeFileSync("public/icons/icon-512.png", render(512, { bg: "#FFFFFF" }));
writeFileSync("public/icons/maskable-512.png", render(512, { bg: "#05112B", radius: 0, markScale: 0.5 }));
writeFileSync("public/icons/apple-touch-icon.png", render(180, { bg: "#05112B", radius: 0, markScale: 0.58 }));
writeFileSync("public/icons/mark-256.png", render(256, { bg: null, markScale: 0.96 }));
console.log("icons written");
