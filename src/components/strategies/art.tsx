/**
 * Custom illustrations, one per strategy: navy tile, girih hint, and a motif
 * drawn in the strategy's accent. Inline SVG — licence-free, offline, tiny.
 */
import type { StrategySlug } from "@/lib/domain/types";

const K = "M12 1.5L14.93 4.43L19.07 4.43L19.07 8.57L22 11.5L19.07 14.43L19.07 18.57L14.93 18.57L12 21.5L9.07 18.57L4.93 18.57L4.93 14.43L2 11.5L4.93 8.57L4.93 4.43L9.07 4.43Z";
const INK = "#DCE6FB";
const DIM = "rgba(220,230,251,0.28)";

function Motif({ slug, a }: { slug: StrategySlug; a: string }) {
  switch (slug) {
    case "pay-yourself-first":
      // A coin stream splitting: one share drops into a jar first.
      return (
        <g>
          <path d="M60 30v34" stroke={DIM} strokeWidth="2" strokeDasharray="3 4" />
          <circle cx="60" cy="24" r="9" fill="none" stroke={INK} strokeWidth="2" />
          <path d="M60 64 L42 82 M60 64 L78 82" stroke={DIM} strokeWidth="2" />
          <rect x="28" y="84" width="28" height="30" rx="7" fill={a} />
          <rect x="33" y="80" width="18" height="6" rx="2" fill={a} opacity="0.7" />
          <circle cx="42" cy="99" r="6" fill="none" stroke="#fff" strokeWidth="2" />
          <rect x="66" y="92" width="26" height="22" rx="5" fill="none" stroke={INK} strokeWidth="2" />
          <text x="42" y="132" textAnchor="middle" fontSize="10" fontWeight="700" fill={a} fontFamily="var(--font-mono)">1</text>
          <text x="79" y="132" textAnchor="middle" fontSize="10" fontWeight="700" fill={INK} fontFamily="var(--font-mono)">2</text>
        </g>
      );
    case "rule-50-30-20":
      return (
        <g>
          <rect x="22" y="40" width="76" height="16" rx="5" fill="rgba(255,255,255,0.08)" />
          <rect x="22" y="40" width="38" height="16" rx="5" fill={a} />
          <rect x="62" y="40" width="22" height="16" rx="4" fill={INK} opacity="0.8" />
          <rect x="86" y="40" width="12" height="16" rx="4" fill="#F2CF7E" />
          {[["50", 41, a], ["30", 73, INK], ["20", 92, "#F2CF7E"]].map(([v, x, c]) => (
            <text key={v as string} x={x as number} y="76" textAnchor="middle" fontSize="12" fontWeight="700" fill={c as string} fontFamily="var(--font-mono)">{v}</text>
          ))}
          <path d="M30 100h60M30 112h40" stroke={DIM} strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case "zero-based":
      return (
        <g>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x="26" y={30 + i * 18} width="50" height="10" rx="3" fill={i === 3 ? a : INK} opacity={i === 3 ? 1 : 0.75 - i * 0.12} />
              <rect x="80" y={30 + i * 18} width="14" height="10" rx="3" fill={DIM} />
            </g>
          ))}
          <path d="M26 110H94" stroke={INK} strokeWidth="1.5" />
          <text x="94" y="128" textAnchor="end" fontSize="16" fontWeight="700" fill={a} fontFamily="var(--font-mono)">= 0</text>
        </g>
      );
    case "envelopes":
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${24 + i * 8} ${36 + i * 22})`}>
              <rect width="64" height="38" rx="5" fill={i === 2 ? a : "rgba(255,255,255,0.08)"} stroke={i === 2 ? "none" : INK} strokeWidth="1.5" />
              <path d="M2 4 L32 24 L62 4" fill="none" stroke={i === 2 ? "#1E1504" : INK} strokeWidth="1.5" opacity="0.8" />
            </g>
          ))}
        </g>
      );
    case "kakeibo":
      return (
        <g>
          <rect x="30" y="26" width="60" height="92" rx="6" fill="rgba(255,255,255,0.06)" stroke={INK} strokeWidth="1.5" />
          <rect x="30" y="26" width="10" height="92" rx="3" fill={a} />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <circle cx="52" cy={44 + i * 20} r="3" fill={i === 3 ? a : INK} />
              <path d={`M60 ${44 + i * 20}h22`} stroke={DIM} strokeWidth="2" strokeLinecap="round" />
            </g>
          ))}
          <text x="60" y="137" textAnchor="middle" fontSize="11" fill={INK} fontFamily="serif">家計簿</text>
        </g>
      );
    case "profit-first":
      return (
        <g>
          <rect x="44" y="24" width="32" height="20" rx="5" fill={INK} opacity="0.85" />
          <path d="M60 44v12M60 56H26v10M60 56h34v10M43 56v10M77 56v10" stroke={DIM} strokeWidth="2" fill="none" />
          {[["#F2CF7E", 18], [INK, 35], ["#FF8FA0", 69], ["#5EE0B0", 86]].map(([c, x], i) => (
            <rect key={i} x={x as number} y="68" width="16" height={i === 0 ? 20 : 34 + i * 4} rx="4" fill={c as string} opacity={i === 0 ? 1 : 0.8} />
          ))}
          <text x="26" y="104" textAnchor="middle" fontSize="9" fontWeight="700" fill="#F2CF7E" fontFamily="var(--font-mono)">%</text>
        </g>
      );
    case "sinking-funds":
      return (
        <g>
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={24 + i * 15} y={110 - (i + 1) * 14} width="11" height={(i + 1) * 14} rx="3" fill={i === 4 ? a : INK} opacity={i === 4 ? 1 : 0.35 + i * 0.1} />
          ))}
          <path d={K} transform="translate(80 22) scale(0.9)" fill="none" stroke={a} strokeWidth="1.6" />
          <path d="M24 116H96" stroke={INK} strokeWidth="1.5" />
        </g>
      );
    case "emergency-fund":
      return (
        <g>
          <path d="M60 22 L92 34 V66 C92 90 76 106 60 116 C44 106 28 90 28 66 V34 Z" fill="rgba(255,255,255,0.06)" stroke={a} strokeWidth="2.5" strokeLinejoin="round" />
          <path d={K} transform="translate(46 48) scale(1.15)" fill={a} />
          <path d="M20 128h80" stroke={DIM} strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" />
        </g>
      );
    case "debt-payoff":
      return (
        <g>
          {[40, 28, 18, 10].map((w, i) => (
            <rect key={i} x={60 - w} y={34 + i * 20} width={w * 2} height="12" rx="4" fill={i === 0 ? a : INK} opacity={i === 0 ? 1 : 0.8 - i * 0.15} />
          ))}
          <path d="M100 36 V108" stroke={DIM} strokeWidth="2" />
          <path d="M94 100 L100 110 L106 100" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="22" cy="104" r="7" fill="none" stroke={INK} strokeWidth="2" />
          <circle cx="22" cy="104" r="2.5" fill={INK} />
        </g>
      );
    case "lifestyle-inflation":
      return (
        <g>
          <path d="M22 112 L46 92 L66 98 L98 46" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 116 L46 108 L66 108 L98 100" fill="none" stroke={a} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M98 46 L98 100" stroke="#5EE0B0" strokeWidth="2" strokeDasharray="3 4" />
          <path d="M92 52 L98 46 L104 52" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
          <circle cx="98" cy="73" r="5" fill="#5EE0B0" />
        </g>
      );
  }
}

export function StrategyArt({ slug, accent, className, size = 120 }: { slug: StrategySlug; accent: string; className?: string; size?: number }) {
  const a = accent === "#071330" ? "#7AA7F7" : accent;
  return (
    <svg viewBox="0 0 120 144" width={size} height={(size * 144) / 120} className={className} aria-hidden>
      <defs>
        <pattern id={`g-${slug}`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M20 9l3.3 3.3h4.6v4.6L31.2 20l-3.3 3.3v4.6h-4.6L20 31.2l-3.3-3.3h-4.6v-4.6L8.8 20l3.3-3.3v-4.6h4.6z" fill="none" stroke="rgba(159,192,255,0.12)" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="120" height="144" fill={`url(#g-${slug})`} />
      <Motif slug={slug} a={a} />
    </svg>
  );
}
