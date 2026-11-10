import Anthropic from "@anthropic-ai/sdk";

/** Shared server-side Claude client. The API key is read from the environment only. */
export const CLAUDE_MODEL = process.env.SOQQA_AI_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;

export function aiConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function getClaude(): Anthropic {
  if (!client) client = new Anthropic({ maxRetries: 2, timeout: 60_000 });
  return client;
}
