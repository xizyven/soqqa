/**
 * Build-time deployment flags.
 *
 * STATIC_EXPORT is set for the GitHub Pages build (`output: "export"`): there
 * are no server routes, so cloud AI is disabled and the offline engines are
 * used. BASE_PATH is the sub-path the site is served from (e.g. "/soqqa").
 */
export const STATIC_EXPORT = process.env.NEXT_PUBLIC_STATIC_EXPORT === "1";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a root-relative public path ("/icons/x.png") with the base path. */
export function withBase(path: string): string {
  return BASE_PATH + path;
}
