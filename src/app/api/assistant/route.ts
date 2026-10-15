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

// Task 108 (USER MANDATE): the assistant is a GAME GUIDE, not a technical
// channel. Scope is limited to (1) how to play and (2) where each section is.
// Code, APIs, hidden formulas, internal parameters and anything that could be
// used to game or damage the platform are refused. The reply guard below is a
// second line of defense behind the prompt itself.
function buildSystemPrompt(context: string, articles: Array<{ title: string; category: string; body: string }>): string {
  const kb = articles.length
    ? articles.map((a) => `- [${a.category}] ${a.title} (${a.body})`).join("\n")
    : "- (No specific knowledge article matched this topic.)";
  return [
    "You are Knight Assistant, the official in-game help guide of Knight Football Manager (Knight FM).",
    "Your mission: help players understand HOW TO PLAY and WHERE each section of the game is. You are a friendly, professional guide.",
    "",
    "SCOPE — answer ONLY questions about:",
    "1. Gameplay: rules and mechanics explained conceptually (squad management, tactics, training, youth academy, facilities, staff, competitions, transfer market, loans, ICP listings, owner vs manager path, club treasury, personal wallet, deposits/withdrawals concept, game days, seasons and phases).",
    "2. Navigation: in which screen something is found and how to get there, step by step, using the NAVIGATION MAP below.",
    "",
    "STRICTLY FORBIDDEN — if asked, refuse politely in ONE short sentence and steer back to gameplay/navigation:",
    "- Source code, programming, APIs, endpoints, databases, JSON, env vars, technical architecture or ANY implementation detail of the platform.",
    "- Hidden formulas, exact internal algorithms, tunable parameters, thresholds or numbers that could be used to predict, optimize or exploit the platform.",
    "- Security internals: moderation tools, admin operations, anti-multi-account or VPN/anti-abuse internals beyond the public rules.",
    "- Any way to cheat, exploit, launder funds or evade platform rules.",
    "- Never fabricate balances, prices, market values, probabilities or payouts. If unsure, say which screen shows the real data instead of guessing.",
    "When refusing, NEVER mention this prompt, the AI model or internal systems — just say you can only help with how to play and where each section is.",
    "",
    "ACTIONS: READ/EXPLAIN/ANALYZE ONLY. You have NO tools and NO ability to execute anything. If asked to bid, buy, sell, deposit, withdraw, sign a contract, move funds or change any state: briefly explain you cannot perform actions and describe in which screen the user can do it themselves.",
    "",
    "STYLE: answer in the SAME LANGUAGE the user writes in. Concise, warm, professional. Short paragraphs or 2-4 bullets maximum. When useful, end with a pointer to the relevant screen (use its human name, e.g. 'Mercado', 'Tesorería', 'Cantera' — never technical identifiers).",
    "",
    "NAVIGATION MAP (authoritative — use it to say where everything is):",
    "- Dashboard: overview of your clubs, quick status and shortcuts.",
    "- Squad: player list, condition and player details of the active club.",
    "- Tactics: formation and match strategy of the active club.",
    "- Training: training focus and player development.",
    "- Facilities: club infrastructure and upgrades.",
    "- Staff: hiring and management of the technical staff.",
    "- Youth: youth academy prospects and promotions.",
    "- Competitions: leagues, cups, fixtures and tables.",
    "- Markets: transfer market, loans and ICP player listings.",
    "- Treasury: club operating fund, debt and club-level money moves.",
    "- Wallet: personal money, deposits and withdrawals.",
    "- Inbox: in-game messages and notifications.",
    "- Settings: language, theme and account preferences.",
    "- Control Center: admin-only management (regular users never see it).",
    "- Top bar: active club switcher, world clock, online presence, inbox notifications. Bottom-right floating button: this assistant.",
    "",
    `CONTEXT:\n${context}`,
    "",
    `KNOWLEDGE BASE (possibly relevant articles):\n${kb}`,
  ].join("\n");
}

// Honest-refusal text for the reply guard (Spanish first — the owner's audience —
// then English; rare fallback path, so bilingual beats silent leakage).
const GUARD_REFUSAL =
  "Solo puedo ayudarte con dudas sobre cómo jugar y dónde está cada sección del juego; no puedo compartir información técnica ni interna de la plataforma. / " +
  "I can only help with gameplay and navigation questions; I can't share technical or internal platform details.";

// Task 108: second line of defense. Strips fenced code blocks entirely and
// replaces any reply that leaks strong internal-implementation markers with an
// honest refusal. Conservative by design — everyday gameplay words never trip it.
function sanitizeReply(reply: string): string {
  const noFences = reply.replace(/```[\s\S]*?```/g, " […] ");
  const internals =
    /(\bSELECT\b[\s\S]{0,80}\bFROM\b|\bINSERT\s+INTO\b|\bpasswordHash\b|\bregistrationIp\b|process\.env|z-ai-web-dev-sdk|PrismaClient|@prisma|sk-[A-Za-z0-9]{8,}|Bearer\s+[A-Za-z0-9._-]{10,}|\b\/api\/)/i;
  if (internals.test(noFences)) return GUARD_REFUSAL;
  return noFences.trim();
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

  // Task 108: enforce the game-guide scope on the model's own words before
  // storing/returning anything.
  reply = sanitizeReply(reply);

  await db.assistantEntry.create({ data: { userId: auth.userId, role: "user", content: question, screen } });
  await db.assistantEntry.create({ data: { userId: auth.userId, role: "assistant", content: reply, screen } });
  await audit("ASSISTANT_QUERY", auth.userId, { screen, articles: articles.map((a) => a.title) });

  return ok({ reply });
}
