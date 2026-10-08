// Knight FM — RFC 9116 security.txt (static, text/plain).
// https://www.rfc-editor.org/rfc/rfc9116

import { NextResponse } from "next/server";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000")
  .trim()
  .replace(/\/+$/, "");

// Expires must be an ISO 8601 / W3C datetime (always UTC "Z"), refreshed +1 year.
const EXPIRES = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

const BODY = [
  "Contact: mailto:security@knightfm.game",
  `Expires: ${EXPIRES}`,
  "Preferred-Languages: es, en, fr, pt",
  `Canonical: ${SITE}/.well-known/security.txt`,
  "",
].join("\n");

export async function GET() {
  return new NextResponse(BODY, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
