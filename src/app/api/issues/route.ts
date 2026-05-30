import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── GSSoC label variants ────────────────────────────────────────────────────
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

// ─── Rules ───────────────────────────────────────────────────────────────────
const CUTOFF_MS = 24 * 60 * 60 * 1000; // Rule 1: 24 hours
const MAX_PER_REPO = 2;                 // Anti-spam: max 2 issues per repo

// ─── Auto-generated / spam issue detection ───────────────────────────────────
// Detects bulk machine-generated test issues like:
//   "test(cache): verify TTLCache behavior ... (Variation 3)"
//   "test(mongodb): verify User schema ... (Variation 1)"
// These follow a strict programmatic pattern and flood the feed with noise.
const SPAM_PATTERNS = [
  /\(variation\s*\d+\)/i,           // "(Variation N)" suffix
  /^test\([a-z:]+\):\s*verify/i,   // "test(x): verify ..." auto-test titles
  /^test\([a-z:]+\):\s*check/i,    // "test(x): check ..." auto-test titles
];

function isSpam(title: string): boolean {
  return SPAM_PATTERNS.some((re) => re.test(title));
}

function isWithin24h(isoString: string): boolean {
  return Date.now() - new Date(isoString).getTime() <= CUTOFF_MS;
}

// ─── GitHub headers ──────────────────────────────────────────────────────────
function ghHeaders(token: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// ─── Single GitHub search call ───────────────────────────────────────────────
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
    const t = reset
      ? new Date(parseInt(reset) * 1000).toLocaleTimeString()
      : "soon";
    throw new Error(`RATE_LIMIT:${t}`);
  }

  if (!res.ok) throw new Error(`GITHUB_ERROR:${res.status}`);

  const data = await res.json();
  if (data.message && !data.items) {
    if (data.message.toLowerCase().includes("rate limit"))
      throw new Error("RATE_LIMIT:soon");
    throw new Error(`GITHUB_MSG:${data.message}`);
  }

  return (data.items || []) as any[];
}

// ─── Core filter (Rules 1, 2 + spam guard) ───────────────────────────────────
function passesRules(issue: any): boolean {
  return (
    !issue.pull_request &&           // exclude PRs
    issue.comments === 0 &&          // Rule 2: zero comments
    isWithin24h(issue.updated_at) && // Rule 1: updated within 24 hours
    !isSpam(issue.title)             // spam guard: no bulk auto-generated issues
  );
}

// ─── Dedupe + per-repo cap ────────────────────────────────────────────────────
function collect(
  batches: any[][],
  seen: Set<number>,
  repoCounts: Map<string, number>
): any[] {
  const result: any[] = [];
  for (const items of batches) {
    for (const issue of items) {
      if (seen.has(issue.id)) continue;
      if (!passesRules(issue)) continue;

      const repoKey = issue.repository_url;
      const count = repoCounts.get(repoKey) || 0;
      if (count >= MAX_PER_REPO) continue; // Anti-spam: max 2 per repo

      seen.add(issue.id);
      repoCounts.set(repoKey, count + 1);
      result.push(issue);
    }
  }
  return result;
}

// ─── Route handler ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    // Resolve GitHub token
    const authHeader = req.headers.get("authorization");
    const clientToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;
    const session = await getServerSession(authOptions);
    const userToken = (session as any)?.accessToken;
    const GH_TOKEN =
      clientToken || userToken || process.env.GITHUB_API_TOKEN || "";

    // Parse query params
    const { searchParams } = new URL(req.url);
    const scope    = searchParams.get("scope")    || "gssoc";
    const language = searchParams.get("language") || "";
    const label    = searchParams.get("label")    || "";
    const query    = searchParams.get("query")    || "";

    // Optional suffix
    let suffix = "";
    if (language) suffix += ` language:${language}`;
    if (query)    suffix += ` ${query}`;

    // Shared state — single seen set + repo cap across BOTH buckets
    // so the same repo can't take 2 slots in GSSoC AND 2 more in worldwide
    const seen       = new Set<number>();
    const repoCounts = new Map<string, number>();

    // ── BUCKET A: GSSoC (Rule 3 — highest priority) ──────────────────────────
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

    // ── BUCKET B: Worldwide (Rule 3 — supplementary) ──────────────────────────
    const wwLabel = label || "good first issue";
    const wwBase  = `is:issue is:open no:assignee comments:0`;
    const wwQueries = [
      `${wwBase} label:"${wwLabel}"${suffix}`,
      `${wwBase} label:"help wanted"${suffix}`,
      `${wwBase} label:"beginner friendly"${suffix}`,
    ];

    const wwRaws = await Promise.allSettled(
      wwQueries.map((q) => ghSearch(q, GH_TOKEN))
    );
    const wwBatches = wwRaws
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<any[]>).value);

    const wwIssues = collect(wwBatches, seen, repoCounts);

    // ── Rule 3 final merge: GSSoC first, worldwide after ─────────────────────
    const gssocIds = new Set(gssocIssues.map((i) => i.id));
    const merged   = [...gssocIssues, ...wwIssues];

    // Sort each bucket by recency, maintain GSSoC-first order
    const gssocSorted = gssocIssues.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
    const wwSorted = wwIssues.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    const final = [...gssocSorted, ...wwSorted].slice(0, 90);

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