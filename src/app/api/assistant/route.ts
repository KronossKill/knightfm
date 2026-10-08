// Knight FM — Knight Assistant (spec §31). READ/EXPLAIN/ANALYZE ONLY.
// HARD GUARD: the system prompt forbids executing any in-game action; the assistant has no
// tool access, no write paths and no financial capabilities whatsoever (invariant #7).

import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, requireAuth, isResponse, audit, rateLimit, readJson } from "@/lib/api";
import { currentGameDay } from "@/lib/engine/clock";
import { resolveSeason } from "@/lib/engine/clock";
import ZAI from "z-ai-web-dev-sdk";

const Msg = z.object({
  role: z.union([z.literal("user"), z.literal("assistant")]),
  content: z.string().min(1).max(4000),
});

const Body = z.object({
  messages: z.array(Msg).min(1).max(10),
  screen: z.string().max(64).optional(),
});

// ─── Knowledge base (articles seeded with i18n keys; humanized for prompting) ──

function humanizeKey(key: string): string {
  return key
    .replace(/^kb\./, "")
    .replace(/\.(title|body)$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

async function loadRelevantArticles(query: string) {
  const articles = await db.knowledgeArticle.findMany();
  if (articles.length === 0) return [];
  const tokens = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 3);
  const scored = articles.map((a) => {
    const hay = `${a.slug} ${a.titleKey} ${a.bodyKey} ${a.category}`.toLowerCase();
    let score = 0;
    for (const t of tokens) if (hay.includes(t)) score++;
    if (query.toLowerCase().includes(a.category.toLowerCase())) score += 2;
    return { a, score };
  });
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, 4).map(({ a }) => ({
    title: humanizeKey(a.titleKey || a.slug),
    category: a.category,
    body: humanizeKey(a.bodyKey || a.slug).slice(0, 3000), // keys only — full text lives in the client Knowledge UI
  }));
}

function buildSystemPrompt(context: string, articles: Array<{ title: string; category: string; body: string }>): string {
  const kb = articles.length
    ? articles.map((a) => `- [${a.category}] ${a.title} (${a.body})`).join("\n")
    : "- (Knowledge base is currently empty for this topic.)";
  return [
    "You are Knight Assistant, the in-game help assistant of Knight Football Manager.",
    "ABSOLUTE RULE: you operate in READ/EXPLAIN/ANALYZE mode ONLY. You have NO tools and NO ability to execute anything.",
    "You MUST refuse and redirect any request to execute actions: bids, purchases, sales, transfers, deposits, withdrawals, ownership changes, treasury moves, contract signings or any other state-changing operation. In that case, briefly explain that you cannot perform actions and describe how the user can do it themselves in the relevant screen.",
    "Never invent financial numbers, prices, balances or market data. If unsure, say what screen or knowledge article to consult.",
    "Answer in the language the user writes in. Be concise, structured and helpful.",
    "",
    `CONTEXT:\n${context}`,
    "",
    `KNOWLEDGE BASE (titles summarized):\n${kb}`,
  ].join("\n");
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isResponse(auth)) return auth;

  const rl = rateLimit(`asst:${auth.userId}`, 20, 10 * 60_000);
  if (!rl.allowed) return fail("RATE_LIMITED", `Assistant limit reached. Retry in ${rl.retryAfterSec}s`, 429);

  const parsed = Body.safeParse((await readJson(req)) ?? {});
  if (!parsed.success) return fail("BAD_REQUEST", "messages (1–10, role user|assistant) are required", 400);

  const lastUser = [...parsed.data.messages].reverse().find((m) => m.role === "user");
  const question = lastUser?.content ?? "";
  const screen = parsed.data.screen ?? "unknown";

  // Cheap world + club context.
  const gameDay = await currentGameDay();
  const season = await resolveSeason(gameDay);
  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { username: true, path: true, clubsOwned: { select: { name: true, operatingFund: true, debt: true, finState: true }, take: 3 }, clubsManaged: { select: { name: true }, take: 3 } },
  });
  const owned = user?.clubsOwned ?? [];
  const managed = user?.clubsManaged ?? [];
  const context = [
    `User: ${user?.username ?? "unknown"} (path: ${user?.path ?? "unset"})`,
    `Game day: ${gameDay}${season ? `, season ${season.number}, season day ${season.seasonDay} (${season.phase})` : ""}`,
    owned.length > 0
      ? `Owned clubs: ${owned.map((c) => `${c.name} [fund ${c.operatingFund}, debt ${c.debt}, ${c.finState}]`).join("; ")}`
      : "Owned clubs: none",
    managed.length > 0 ? `Managed clubs: ${managed.map((c) => c.name).join("; ")}` : "Managed clubs: none",
    `Current screen: ${screen}`,
  ].join("\n");

  const articles = await loadRelevantArticles(question);
  const systemPrompt = buildSystemPrompt(context, articles);

  let reply: string | null = null;
  try {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        ...parsed.data.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });
    const content = (completion as { choices?: Array<{ message?: { content?: unknown } }> })?.choices?.[0]?.message?.content;
    reply = typeof content === "string" && content.trim() ? content.trim() : null;
  } catch {
    reply = null;
  }

  if (!reply) {
    // Honest degradation: 503 with knowledge-base fallback text (no fabricated answer).
    const fallback = articles[0]
      ? `The assistant service is temporarily unavailable. Closest knowledge article: [${articles[0].category}] ${articles[0].title}. Open the in-game Knowledge section for the full article.`
      : "The assistant service is temporarily unavailable. Please try again later or consult the in-game Knowledge section.";
    await audit("ASSISTANT_UNAVAILABLE", auth.userId, { screen });
    return fail("ASSISTANT_UNAVAILABLE", fallback, 503);
  }

  await db.assistantEntry.create({ data: { userId: auth.userId, role: "user", content: question, screen } });
  await db.assistantEntry.create({ data: { userId: auth.userId, role: "assistant", content: reply, screen } });
  await audit("ASSISTANT_QUERY", auth.userId, { screen, articles: articles.map((a) => a.title) });

  return ok({ reply });
}
