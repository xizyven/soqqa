/**
 * Optional LLM advisor. Receives only aggregated figures (month and category
 * totals) — never notes, merchant names, wallet names or goal names — and
 * answers with explanations grounded strictly in those numbers.
 */
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { aiConfigured, CLAUDE_MODEL, getClaude } from "@/lib/server/claude";
import { authenticate, errorResponse, HttpError, rateLimit, readJson } from "@/lib/server/guard";

export const runtime = "nodejs";

const decimal = z.string().regex(/^-?\d{1,15}(\.\d{1,2})?$/);
const SummarySchema = z.object({
  base_currency: z.enum(["UZS", "USD", "EUR", "RUB"]),
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  months: z
    .array(
      z.object({
        month: z.string().regex(/^\d{4}-\d{2}$/),
        partial: z.boolean(),
        income: decimal,
        expense: decimal,
        categories: z.array(z.object({ category: z.string().max(60), amount: decimal })).max(12),
      }),
    )
    .max(12),
  goals: z
    .array(
      z.object({
        label: z.string().regex(/^goal_\d{1,2}$/),
        currency: z.enum(["UZS", "USD", "EUR", "RUB"]),
        target: decimal,
        saved: decimal,
        required_monthly: decimal.nullable(),
        months_left: z.number().int().nullable(),
      }),
    )
    .max(20),
});

const InputSchema = z.object({
  question: z.string().trim().min(1).max(500),
  locale: z.enum(["uz", "en", "ru"]),
  summary: SummarySchema,
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(10),
});

const LANG = { uz: "Uzbek (Latin script, natural modern Uzbek)", en: "English", ru: "Russian" } as const;

function systemPrompt(locale: keyof typeof LANG) {
  return `You are Soqqa's personal finance analyst. You explain the user's own spending using ONLY the aggregated figures provided in the data block.
Ground rules:
- Use only numbers present in the data or arithmetic you show on them. Never invent transactions, balances, merchants or accounts.
- Separate facts (directly from the data) from estimates (projections or what-ifs), and label estimates as such.
- Briefly show how each calculated figure was derived.
- Soqqa is a manual tracker: it has no access to bank accounts and cannot move money or take actions. Do not claim otherwise.
- This is analysis, not licensed financial advice; avoid recommending specific investment products.
- The current month may be partial (partial: true) — compare like-for-like or say so.
- Amounts are in the stated currency; format numbers with thousands separators.
- Keep answers concise: a short summary, then bullet points. Reply in ${LANG[locale]}.`;
}

export async function POST(req: Request) {
  try {
    const identity = await authenticate(req);
    rateLimit(identity, "ai-advisor", 10);
    if (!aiConfigured()) throw new HttpError(503, "ai_not_configured");
    const parsed = InputSchema.safeParse(await readJson(req, 64_000));
    if (!parsed.success) throw new HttpError(400, "invalid_input");
    const { question, locale, summary, history } = parsed.data;

    const messages: Anthropic.Beta.BetaMessageParam[] = [
      { role: "user", content: `Financial data (JSON, aggregated):\n${JSON.stringify(summary)}` },
      { role: "assistant", content: "Understood. I will answer only from these figures." },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: question },
    ];

    const response = await getClaude().beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium" },
      system: systemPrompt(locale),
      messages,
    });

    if (response.stop_reason === "refusal") throw new HttpError(422, "declined");
    const answer = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    if (!answer) throw new HttpError(502, "empty_answer");
    return Response.json({ answer });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return Response.json({ error: "upstream_rate_limited" }, { status: 503 });
    if (e instanceof Anthropic.AuthenticationError) return Response.json({ error: "ai_not_configured" }, { status: 503 });
    if (e instanceof Anthropic.APIConnectionError) return Response.json({ error: "upstream_unavailable" }, { status: 503 });
    if (e instanceof Anthropic.APIError) return Response.json({ error: "upstream_error" }, { status: 502 });
    return errorResponse(e);
  }
}
