/**
 * Offline natural-language transaction parser (Uzbek / Russian / English).
 * Deterministic regex + keyword rules. The result is ALWAYS a draft shown in an
 * editable confirmation preview — it never writes records by itself.
 */
import { addDays, isValidLocalDate } from "../domain/dates";
import { parseAmount, toAmountString } from "../money/money";
import type { Currency, LocalDate } from "../domain/types";

export interface ParserWallet {
  id: string;
  name: string;
  currency: Currency;
  icon: string;
}

export interface ParsedTransaction {
  amount: string | null;
  currency: Currency | null;
  type: "income" | "expense";
  categoryKey: string | null;
  walletId: string | null;
  date: LocalDate;
  merchant: string;
  note: string;
  /** Which fields were explicitly recognised in the text. */
  recognized: { amount: boolean; currency: boolean; type: boolean; category: boolean; wallet: boolean; date: boolean; merchant: boolean };
  source: "offline" | "cloud";
}

export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// --- dates -----------------------------------------------------------------

const DATE_RULES: { re: RegExp; offset: (m: RegExpMatchArray) => number }[] = [
  { re: /(\d{1,2})\s*(kun|кун)\s*(oldin|avval|олдин)/, offset: (m) => -Number(m[1]) },
  { re: /(\d{1,2})\s*(дн(я|ей)|день)\s*назад/, offset: (m) => -Number(m[1]) },
  { re: /(\d{1,2})\s*days?\s*ago/, offset: (m) => -Number(m[1]) },
  { re: /o'tgan kuni|o'tgan kun|позавчера|day before yesterday|ўтган куни/, offset: () => -2 },
  { re: /\bkecha\b|кеча|вчера|yesterday/, offset: () => -1 },
  { re: /\bbugun\b|бугун|сегодня|today|tonight/, offset: () => 0 },
];

function extractDate(text: string, today: LocalDate): { date: LocalDate; found: boolean; rest: string } {
  const explicit = text.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/);
  const looksLikeAmount =
    explicit &&
    /^\s*(mln|mlrd|ming|минг|млн|тыс|million|thousand|k\b|\$|€|₽|so'm|som|sum|сум|сўм|usd|dollar|доллар|руб|rub|eur|евро)/.test(
      text.slice((explicit.index ?? 0) + explicit[0].length),
    );
  if (explicit && !looksLikeAmount) {
    const d = Number(explicit[1]);
    const m = Number(explicit[2]);
    let y = explicit[3] ? Number(explicit[3]) : Number(today.slice(0, 4));
    if (y < 100) y += 2000;
    const candidate = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (m >= 1 && m <= 12 && isValidLocalDate(candidate)) {
      // Without a year, a future date means last year's.
      const date = !explicit[3] && candidate > today ? `${y - 1}${candidate.slice(4)}` : candidate;
      return { date, found: true, rest: text.replace(explicit[0], " ") };
    }
  }
  for (const rule of DATE_RULES) {
    const m = text.match(rule.re);
    if (m) return { date: addDays(today, rule.offset(m)), found: true, rest: text.replace(m[0], " ") };
  }
  return { date: today, found: false, rest: text };
}

// --- amount & currency -------------------------------------------------------

const CURRENCY_WORDS: [Currency, RegExp][] = [
  ["USD", /(\$|\busd\b|dollar\w*|доллар\w*|долл\.?|бакс\w*|\bdollor\w*)/],
  ["EUR", /(€|\beur\b|euro\w*|евро|yevro)/],
  ["RUB", /(₽|\brub\b|rubl\w*|руб\w*|рубл\w*)/],
  ["UZS", /(so'm\w*|\bsom\b|\bsum\b|сум(?!м)|сўм|\buzs\b|so'mlik)/],
];

const MULTIPLIERS: [RegExp, bigint][] = [
  [/^(mlrd|milliard|миллиард\w*|млрд)/, 1_000_000_000n],
  [/^(mln|million\w*|миллион\w*|млн|million)/, 1_000_000n],
  [/^(ming|минг|тысяч\w*|тыс\.?|thousand|k\b|к(?![а-яё]))/, 1_000n],
];

const NUMBER_RE = /(\$|€|₽)?\s?(\d{1,3}(?:[  .,]\d{3})+|\d+)(?:[.,](\d{1,2}))?(?!\d)\s*(\$|€|₽)?/g;

function extractAmount(text: string): { amount: string | null; currency: Currency | null } {
  let best: { value: bigint; currency: Currency | null } | null = null;
  for (const m of text.matchAll(NUMBER_RE)) {
    const intPart = m[2].replace(/[  .,]/g, "");
    const frac = m[3] ?? "";
    let value: bigint;
    try {
      value = parseAmount(frac ? `${intPart}.${frac}` : intPart);
    } catch {
      continue;
    }
    const after = text.slice((m.index ?? 0) + m[0].length).trimStart();
    for (const [re, mult] of MULTIPLIERS) {
      if (re.test(after)) {
        value *= mult;
        break;
      }
    }
    let currency: Currency | null = null;
    const sym = m[1] || m[4];
    if (sym === "$") currency = "USD";
    else if (sym === "€") currency = "EUR";
    else if (sym === "₽") currency = "RUB";
    else {
      const window = after.slice(0, 24);
      for (const [cur, re] of CURRENCY_WORDS) if (re.test(window)) {
        currency = cur;
        break;
      }
    }
    if (value > 0n && (!best || value > best.value)) best = { value, currency };
  }
  if (!best) return { amount: null, currency: detectCurrency(text) };
  return { amount: toAmountString(best.value), currency: best.currency ?? detectCurrency(text) };
}

function detectCurrency(text: string): Currency | null {
  for (const [cur, re] of CURRENCY_WORDS) if (re.test(text)) return cur;
  return null;
}

// --- type & category ---------------------------------------------------------

const EXPENSE_WORDS = /(sarfla|sarf qil|to'la|xarajat|sotib ol|harid|xarid|ketdi|berdim|потрат|заплат|оплат|купил|расход|spent|spend|paid|pay |bought|buy |cost)/;
const INCOME_WORDS = /(oylik|maosh|ish haqi|daromad|tushdi|keldi|topdim|oldim|олдим|получил|зарплат|доход|заработ|пришл|received|got paid|earned|income|salary|paycheck|got \$)/;

const CATEGORY_KEYWORDS: [string, RegExp][] = [
  ["salary", /(oylik|maosh|ish haqi|зарплат|аванс|salary|paycheck|wage)/],
  ["freelance", /(freelance|frilans|фриланс|upwork|fiverr|loyiha uchun|за проект|client)/],
  ["investments", /(dividend|дивиденд|invest|инвест|aksiya|акци|deposit foiz|процент по вклад)/],
  ["gifts", /(sovg'a|hadya|подар|gift)/],
  ["business", /(biznes|бизнес|business|savdo|выручк|sales)/],
  ["groceries", /(supermarket|korzinka|makro|havas|bozor|oziq-ovqat|mahsulot|продукт|супермаркет|базар|магнит|grocer|market)/],
  ["food", /(tushlik|nonushta|kechki ovqat|ovqat|kafe|restoran|choyxona|osh\b|somsa|evos|oqtepa|lavash|burger|pizza|kofe|coffee|обед|ужин|завтрак|кафе|ресторан|кофе|еда|lunch|dinner|breakfast|restaurant|cafe)/],
  ["transport", /(taksi|taxi|такси|yandex|яндекс|mytaxi|metro|метро|avtobus|автобус|bus|benzin|бензин|yoqilg'i|propan|metan|uber|transport|транспорт)/],
  ["utilities", /(kommunal|коммунал|svet|elektr|электр|gaz\b|газ(?![а-яё])|suv\b|вода|internet|интернет|uzmobile|beeline|ucell|mobiuz|telefon uchun|utility|utilities|electricity)/],
  ["housing", /(ijara|kvartira|uy uchun|аренд|квартир|rent\b|mortgage|ipoteka|ипотек)/],
  ["education", /(kurs|o'qish|universitet|kontrakt|maktab|repetitor|kitob|курс|учеб|универ|контракт|школ|репетитор|книг|course|tuition|school|university|book)/],
  ["entertainment", /(kino|кино|cinema|movie|konsert|концерт|o'yin|игр|game|steam|playstation|bowling)/],
  ["health", /(dorixona|apteka|аптек|dori|лекарств|shifokor|klinika|клиник|врач|doctor|hospital|pharmacy|stomatolog|стоматолог)/],
  ["subscriptions", /(obuna|подписк|netflix|spotify|youtube premium|icloud|chatgpt|subscription|telegram premium)/],
  ["travel", /(sayohat|путешеств|travel|aviabilet|авиабилет|mehmonxona|гостиниц|hotel|flight|samolyot|poyezd|поезд|afrosiyob)/],
  ["shopping", /(kiyim|oyoq kiyim|poyabzal|одежд|обув|shopping|uzum|wildberries|ozon|kiyim-kechak|clothes|shoes|telefon oldim|noutbuk)/],
];

const INCOME_KEYS = new Set(["salary", "freelance", "investments", "gifts", "business"]);

const MERCHANTS = [
  "Korzinka", "Makro", "Havas", "Yandex Go", "Yandex", "MyTaxi", "Uzum", "Evos", "Oqtepa Lavash", "Bellissimo", "KFC", "Wildberries",
  "Ozon", "Netflix", "Spotify", "Apple", "Beeline", "Ucell", "Uzmobile", "Mobiuz", "Click", "Payme", "Upwork", "Fiverr", "Starbucks", "Les Ailes", "Safia",
];

const CASH_RE = /(naqd|naqt|нақд|наличн|налом|cash)/;
const CARD_RE = /(karta|карт|card|humo|uzcard|visa|mastercard)/;

export function parseTransactionText(input: string, opts: { today: LocalDate; wallets: ParserWallet[] }): ParsedTransaction {
  const original = input.trim();
  const text = normalizeText(original);
  const dateRes = extractDate(text, opts.today);
  const amountRes = extractAmount(dateRes.rest);

  let categoryKey: string | null = null;
  for (const [key, re] of CATEGORY_KEYWORDS) {
    if (re.test(text)) {
      categoryKey = key;
      break;
    }
  }

  // "sotib oldim" (bought) contains "oldim" (received): expense words win.
  const expenseHit = EXPENSE_WORDS.test(text);
  const incomeHit = INCOME_WORDS.test(text.replace(/sotib oldim|xarid qildim|qarzga oldim/g, ""));
  let type: "income" | "expense";
  let typeRecognized = true;
  if (expenseHit && !(categoryKey && INCOME_KEYS.has(categoryKey))) type = "expense";
  else if (incomeHit || (categoryKey && INCOME_KEYS.has(categoryKey))) type = "income";
  else {
    type = "expense";
    typeRecognized = false;
  }
  if (type === "expense" && categoryKey && INCOME_KEYS.has(categoryKey)) categoryKey = null;
  if (type === "income" && categoryKey && !INCOME_KEYS.has(categoryKey)) categoryKey = null;

  // Wallet
  let walletId: string | null = null;
  const active = opts.wallets;
  const byName = active.find((w) => w.name.length >= 3 && text.includes(normalizeText(w.name)));
  if (byName) walletId = byName.id;
  else if (CASH_RE.test(text)) walletId = active.find((w) => w.icon === "banknote" || CASH_RE.test(normalizeText(w.name)))?.id ?? null;
  else if (CARD_RE.test(text)) walletId = active.find((w) => w.icon === "credit-card" || CARD_RE.test(normalizeText(w.name)))?.id ?? null;
  const walletRecognized = walletId !== null;
  if (!walletId && amountRes.currency) {
    walletId = active.find((w) => w.currency === amountRes.currency)?.id ?? null;
  }

  // Merchant
  let merchant = "";
  for (const m of MERCHANTS) {
    if (text.includes(m.toLowerCase())) {
      merchant = m;
      break;
    }
  }

  return {
    amount: amountRes.amount,
    currency: amountRes.currency,
    type,
    categoryKey,
    walletId,
    date: dateRes.date,
    merchant,
    note: original.slice(0, 200),
    recognized: {
      amount: amountRes.amount !== null,
      currency: amountRes.currency !== null,
      type: typeRecognized,
      category: categoryKey !== null,
      wallet: walletRecognized,
      date: dateRes.found,
      merchant: merchant !== "",
    },
    source: "offline",
  };
}
