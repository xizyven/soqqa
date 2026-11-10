/**
 * Receipt draft validation (shared by the server route and tests) and the
 * client-side image preparation. A receipt never becomes a transaction
 * without the user reviewing it in the confirmation form.
 */
import { isValidLocalDate } from "../domain/dates";
import { sum, toAmountString, tryParseAmount, type Cents } from "../money/money";
import type { Currency, LocalDate } from "../domain/types";

export interface ReceiptItem {
  name: string;
  amount: string | null;
}

export interface ReceiptDraft {
  isReceipt: boolean;
  merchant: string;
  date: LocalDate;
  /** True when the date was printed on the receipt (otherwise today). */
  dateFound: boolean;
  currency: Currency | null;
  total: string | null;
  items: ReceiptItem[];
  categoryKey: string | null;
  /** The printed total differs from the sum of line items by more than 1%. */
  totalMismatch: boolean;
}

interface RawReceipt {
  isReceipt: boolean;
  merchant: string;
  date: string | null;
  currency: Currency | null;
  total: string | null;
  items: { name: string; amount: string | null }[];
  categoryKey: string | null;
}

const MAX = 10n ** 15n;

function cleanAmount(s: string | null | undefined): string | null {
  if (!s) return null;
  const c = tryParseAmount(s.replace(/[\s  ']/g, "").replace(/,(?=\d{3}\b)/g, "").replace(",", "."));
  return c !== null && c > 0n && c < MAX ? toAmountString(c) : null;
}

/** Validates model output: amounts must parse, dates must be real and not in the future, keys must exist. */
export function sanitizeReceipt(raw: RawReceipt, ctx: { today: LocalDate; categoryKeys: string[] }): ReceiptDraft {
  const items = (raw.items ?? [])
    .slice(0, 30)
    .map((i) => ({ name: String(i.name ?? "").trim().slice(0, 60), amount: cleanAmount(i.amount) }))
    .filter((i) => i.name);
  let total = cleanAmount(raw.total);
  const itemSum: Cents = sum(items.map((i) => (i.amount ? tryParseAmount(i.amount)! : 0n)));
  // With no printed total, fall back to the item sum only when every item has an amount.
  if (!total && items.length && items.every((i) => i.amount)) total = toAmountString(itemSum);
  const totalC = total ? tryParseAmount(total)! : 0n;
  const totalMismatch = !!total && itemSum > 0n && (itemSum > totalC ? itemSum - totalC : totalC - itemSum) * 100n > totalC;
  const dateFound = !!raw.date && isValidLocalDate(raw.date) && raw.date <= ctx.today;
  return {
    isReceipt: !!raw.isReceipt,
    merchant: String(raw.merchant ?? "").trim().slice(0, 120),
    date: dateFound ? raw.date! : ctx.today,
    dateFound,
    currency: raw.currency ?? null,
    total,
    items,
    categoryKey: raw.categoryKey && ctx.categoryKeys.includes(raw.categoryKey) ? raw.categoryKey : null,
    totalMismatch,
  };
}

/** Short note summarising line items, within the transaction note limit. */
export function itemsNote(items: ReceiptItem[], max = 200): string {
  let out = "";
  for (const i of items) {
    const next = out ? `${out}, ${i.name}` : i.name;
    if (next.length > max - 2) return `${out}…`;
    out = next;
  }
  return out;
}

/** Downscales a photo in the browser to a JPEG under ~1 MB before upload. */
export async function prepareReceiptImage(file: File, maxSide = 1600): Promise<{ data: string; mediaType: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const g = canvas.getContext("2d");
  if (!g) throw new Error("canvas_unavailable");
  g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const q of [0.82, 0.7, 0.55]) {
    const url = canvas.toDataURL("image/jpeg", q);
    const data = url.slice(url.indexOf(",") + 1);
    if (data.length <= 1_400_000) return { data, mediaType: "image/jpeg" };
  }
  throw new Error("image_too_large");
}
