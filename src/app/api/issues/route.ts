import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export const dynamic  = "force-dynamic";
export const revalidate = 0;

// ─── ALL GSSoC label variants ─────────────────────────────────────────────────
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

// ─── ALL SSOC label variants ──────────────────────────────────────────────────
const SSOC_LABELS = [
  `label:ssoc`,
  `label:"ssoc'25"`,
  `label:ssoc-2025`,
  `label:"SSOC 2025"`,
  `label:"Social Summer of Code"`,
  `label:ssoc25`,
];

// ─── Spam patterns (auto-generated junk) ─────────────────────────────────────
const SPAM_RE = [
  /\(variation\s*\d+\)/i,
  /^test\([a-z:]+\):\s*(verify|check)/i,
  /^\[bot\]/i,
  /^chore\(auto\)/i,
];
const isSpam = (t: string) => SPAM_RE.some((r) => r.test(t));

// ─── GitHub fetch helper ──────────────────────────────────────────────────────
function ghHeaders(token: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Cache-Control": "no-store",
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function ghSearch(
  q: string,
  token: string,
  sort = "updated",
  page = 1
): Promise<any[]> {
  const url =
    `https://api.github.com/search/issues` +
    `?q=${encodeURIComponent(q)}` +
    `&sort=${sort}&order=desc` +
    `&per_page=50&page=${page}` +
    `&_cb=${Date.now()}`;               // cache-buster

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

// ─── Strict filter: 0 comments, no assignee, no PR, no spam ─────────────────
// NOTE: We do NOT filter by date on server — GitHub already sorts by updated desc.
// Client can show "Xd ago" badge. Strict 24h kills too many valid GSSoC issues.
function passes(issue: any): boolean {
  return (
    !issue.pull_request &&
    issue.comments === 0 &&
    !issue.assignee &&
    !isSpam(issue.title)
  );
}

// ─── Collect from batches, dedup, max 3 per repo to keep feed diverse ────────
const MAX_PER_REPO = 3;

function collect(
  batches: any[][],
  seen: Set<number>,
  repoCounts: Map<string, number>
): any[] {
  const out: any[] = [];
  for (const items of batches) {
    for (const issue of items) {
      if (seen.has(issue.id) || !passes(issue)) continue;
      const repo  = issue.repository_url;
      const count = repoCounts.get(repo) ?? 0;
      if (count >= MAX_PER_REPO) continue;
      seen.add(issue.id);
      repoCounts.set(repo, count + 1);
      out.push(issue);
    }
  }
  return out;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    // Token: client header → NextAuth session → env fallback
    const authHeader  = req.headers.get("authorization");
    const clientToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    const session     = await getServerSession(authOptions);
    const userToken   = (session as any)?.accessToken;
    const GH_TOKEN    = clientToken || userToken || process.env.GITHUB_API_TOKEN || "";

    const { searchParams } = new URL(req.url);
    const scope    = searchParams.get("scope")    || "gssoc";   // gssoc | ssoc | both
    const language = searchParams.get("language") || "";
    const label    = searchParams.get("label")    || "";
    const query    = searchParams.get("query")    || "";

    // SSOC not integrated yet
    if (scope === "ssoc_coming") {
      return NextResponse.json({ issues: [], total: 0 });
    }

    // Build optional suffix
    let suffix = "";
    if (language) suffix += ` language:${language}`;
    if (label)    suffix += ` label:"${label}"`;
    if (query)    suffix += ` ${query}`;

    const BASE = `is:issue is:open no:assignee comments:0`;

    const seen       = new Set<number>();
    const repoCounts = new Map<string, number>();
    const allBatches: any[][] = [];

    // ── Decide which label sets to query ─────────────────────────────────────
    const labelSets: string[][] = [];

    if (scope === "gssoc" || scope === "both") labelSets.push(GSSOC_LABELS);
    if (scope === "ssoc"  || scope === "both") labelSets.push(SSOC_LABELS);

    // ── Fire all queries in parallel ──────────────────────────────────────────
    // For each label set we do TWO sorts: updated + created
    // This gives variety — updated catches recently-active, created catches brand new
    const promises: Promise<any[]>[] = [];

    for (const labels of labelSets) {
      for (const lbl of labels) {
        const q = `${BASE} ${lbl}${suffix}`;
        // Sort by updated → most recently touched issues (comments added, labels changed)
        promises.push(ghSearch(q, GH_TOKEN, "updated", 1));
        // Sort by created → brand new issues nobody has touched yet
        promises.push(ghSearch(q, GH_TOKEN, "created", 1));
      }
    }

    // Also add a page 2 of "updated" for top 4 labels to get more results
    for (const lbl of (labelSets[0] || []).slice(0, 4)) {
      const q = `${BASE} ${lbl}${suffix}`;
      promises.push(ghSearch(q, GH_TOKEN, "updated", 2));
    }

    const results = await Promise.allSettled(promises);

    results.forEach((r) => {
      if (r.status === "fulfilled") allBatches.push(r.value);
    });

    const issues = collect(allBatches, seen, repoCounts);

    // Sort: newest updated first
    issues.sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    const final = issues.slice(0, 90);

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