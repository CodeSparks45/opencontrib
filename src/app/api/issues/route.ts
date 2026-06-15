import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── GSSoC EXCLUSIVE LABELS ──────────────────────────────────────────────────
const GSSOC_LABELS = [
  `label:gssoc`,
  `label:"gssoc'26"`,
  `label:gssoc-2026`,
  `label:"GSSoC 2026"`,
  `label:gssoc-ext`,
  `label:"GSSoC-Ext"`,
  `label:"GSSoC-Extended"`,
  `label:gssoc26`,
];

// ─── STRICT RULES ────────────────────────────────────────────────────────────
const CUTOFF_MS = 24 * 60 * 60 * 1000; // Rule 1: Only issues updated within last 24 hours
const MAX_PER_REPO = 2;                // Anti-spam: max 2 issues per repo so feed stays clean

// ─── ANTI-SPAM FILTER ────────────────────────────────────────────────────────
const SPAM_PATTERNS = [
  /\(variation\s*\d+\)/i,           
  /^test\([a-z:]+\):\s*verify/i,   
  /^test\([a-z:]+\):\s*check/i,    
];

function isSpam(title: string): boolean {
  return SPAM_PATTERNS.some((re) => re.test(title));
}

function isWithin24h(isoString: string): boolean {
  return Date.now() - new Date(isoString).getTime() <= CUTOFF_MS;
}

// ─── GITHUB API CONFIG ───────────────────────────────────────────────────────
function ghHeaders(token: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function ghSearch(q: string, token: string): Promise<any[]> {
  const url =
    `https://api.github.com/search/issues` +
    `?q=${encodeURIComponent(q)}` +
    `&sort=updated` +
    `&order=desc` +
    `&per_page=100`;

  const res = await fetch(url, { headers: ghHeaders(token), cache: "no-store" });

  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get("X-RateLimit-Reset");
    const t = reset ? new Date(parseInt(reset) * 1000).toLocaleTimeString() : "soon";
    throw new Error(`RATE_LIMIT:${t}`);
  }

  if (!res.ok) throw new Error(`GITHUB_ERROR:${res.status}`);

  const data = await res.json();
  if (data.message && !data.items) {
    if (data.message.toLowerCase().includes("rate limit")) throw new Error("RATE_LIMIT:soon");
    throw new Error(`GITHUB_MSG:${data.message}`);
  }

  return (data.items || []) as any[];
}

// ─── CORE FILTER (0 COMMENTS + FRESH + NO SPAM) ──────────────────────────────
function passesRules(issue: any): boolean {
  return (
    !issue.pull_request &&           // No PRs allowed
    issue.comments === 0 &&          // STRICT: Exactly 0 comments
    !issue.assignee &&               // STRICT: No assignee
    isWithin24h(issue.updated_at) && // STRICT: Within 24 hours
    !isSpam(issue.title)             // STRICT: No auto-generated spam
  );
}

function collect(batches: any[][], seen: Set<number>, repoCounts: Map<string, number>): any[] {
  const result: any[] = [];
  for (const items of batches) {
    for (const issue of items) {
      if (seen.has(issue.id)) continue;
      if (!passesRules(issue)) continue;

      const repoKey = issue.repository_url;
      const count = repoCounts.get(repoKey) || 0;
      if (count >= MAX_PER_REPO) continue;

      seen.add(issue.id);
      repoCounts.set(repoKey, count + 1);
      result.push(issue);
    }
  }
  return result;
}

// ─── ROUTE HANDLER (GSSOC ONLY) ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const clientToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    const session = await getServerSession(authOptions);
    const userToken = (session as any)?.accessToken;
    const GH_TOKEN = clientToken || userToken || process.env.GITHUB_API_TOKEN || "";

    const { searchParams } = new URL(req.url);
    const language = searchParams.get("language") || "";
    const label    = searchParams.get("label")    || "";
    const query    = searchParams.get("query")    || "";

    let suffix = "";
    if (language) suffix += ` language:${language}`;
    if (query)    suffix += ` ${query}`;

    const seen       = new Set<number>();
    const repoCounts = new Map<string, number>();

    // ONLY FETCHING GSSOC - NOTHING ELSE
    const gssocBase = `is:issue is:open no:assignee comments:0`;
    const gssocRaws = await Promise.allSettled(
      GSSOC_LABELS.map((lbl) => {
        let q = `${gssocBase} ${lbl}${suffix}`;
        if (label) q += ` label:"${label}"`;
        return ghSearch(q, GH_TOKEN);
      })
    );

    const gssocBatches = gssocRaws
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<any[]>).value);

    const gssocIssues = collect(gssocBatches, seen, repoCounts);

    // SORT BY NEWEST FIRST
    const final = gssocIssues.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    ).slice(0, 90);

    return NextResponse.json(
      { issues: final, total: final.length },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (err: any) {
    const msg: string = err?.message || "";
    if (msg.startsWith("RATE_LIMIT")) {
      const resetTime = msg.split(":")[1] || "soon";
      return NextResponse.json(
        { error: "rate_limit", resetTime, issues: [] },
        { status: 429 }
      );
    }
    console.error("[/api/issues]", msg);
    return NextResponse.json(
      { error: "fetch_failed", message: msg, issues: [] },
      { status: 500 }
    );
  }
}