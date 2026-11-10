import { LogoMark, Wordmark } from "./logo";
import { KHATAM_PATH } from "./ornaments";

/** Branded loading state: the mark inside a slowly turning khatam outline. */
export function BootScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-bg" aria-busy="true" aria-label="Soqqa">
      <div className="relative flex size-28 items-center justify-center">
        <svg viewBox="0 0 24 23" className="absolute inset-0 size-full animate-spin-slow text-brand/25" aria-hidden>
          <path d={KHATAM_PATH} fill="none" stroke="currentColor" strokeWidth="0.35" strokeLinejoin="round" />
        </svg>
        <svg viewBox="0 0 24 23" className="absolute inset-3 size-[calc(100%-1.5rem)] text-brand/15 [animation:spin_20s_linear_infinite_reverse]" aria-hidden>
          <path d={KHATAM_PATH} fill="none" stroke="currentColor" strokeWidth="0.45" strokeLinejoin="round" />
        </svg>
        <LogoMark size={40} />
      </div>
      <Wordmark className="text-[26px] leading-none" />
    </div>
  );
}
