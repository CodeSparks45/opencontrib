import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── LABELS ───────────────────────────────────────────────────────────────────
const GSSOC_LABELS = [
  `label:gssoc`, `label:"gssoc'26"`, `label:gssoc-2026`, `label:"GSSoC 2026"`,
  `label:gssoc-ext`, `label:"GSSoC-Ext"`, `label:"GSSoC-Extended"`, `label:gssoc26`
];

const SSOC_LABELS = [
  `label:ssoc`, `label:"ssoc'25"`, `label:ssoc-2025`, `label:"SSOC 2025"`,
  `label:"Social Summer of Code"`, `label:ssoc25`
];

const WORLDWIDE_LABELS = [
  `label:"good first issue"`, `label:"help wanted"`, `label:"beginner friendly"`
];

// ─── ANTI-SPAM ────────────────────────────────────────────────────────────────
const SPAM_RE = [
  /\(variation\s*\d+\)/i,
  /^test\([a-z:]+\):\s*(verify|check)/i,
  /^\[bot\]/i,
  /^chore\(auto\)/i,
];
const isSpam = (t: string) => SPAM_RE.some((r) => r.test(t));

function ghHeaders(token: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Cache-Control": "no-store",
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function ghSearch(q: string, token: string, sort = "updated", page = 1): Promise<any[]> {
  const url =
    `https://api.github.com/search/issues` +
    `?q=${encodeURIComponent(q)}` +
    `&sort=${sort}&order=desc` +
    `&per_page=50&page=${page}` +
    `&_cb=${Date.now()}`;

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

// 🔥 PIVOT: ALLOW UP TO 2 COMMENTS INSTEAD OF 0 🔥
function passes(issue: any): boolean {
  return (
    !issue.pull_request &&
    issue.comments <= 2 && // CHANGED: Now allows 0, 1, or 2 comments
    !issue.assignee &&
    !isSpam(issue.title)
  );
}

const MAX_PER_REPO = 3;

function collect(batches: any[][], seen: Set<number>, repoCounts: Map<string, number>): any[] {
  const out: any[] = [];
  for (const items of batches) {
    for (const issue of items) {
      if (seen.has(issue.id) || !passes(issue)) continue;
      const repo = issue.repository_url;
      const count = repoCounts.get(repo) ?? 0;
      if (count >= MAX_PER_REPO) continue;
      seen.add(issue.id);
      repoCounts.set(repo, count + 1);
      out.push(issue);
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const authHeader  = req.headers.get("authorization");
    const clientToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    const session     = await getServerSession(authOptions);
    const userToken   = (session as any)?.accessToken;
    const GH_TOKEN    = clientToken || userToken || process.env.GITHUB_API_TOKEN || "";

    const { searchParams } = new URL(req.url);
    const scope    = searchParams.get("scope")    || "gssoc"; 
    const language = searchParams.get("language") || "";
    const label    = searchParams.get("label")    || "";
    const query    = searchParams.get("query")    || "";

    if (scope === "ssoc_coming") {
      return NextResponse.json({ issues: [], total: 0 });
    }

    let suffix = "";
    if (language) suffix += ` language:${language}`;
    if (label)    suffix += ` label:"${label}"`;
    if (query)    suffix += ` ${query}`;

    // 🔥 PIVOT: BASE QUERY NOW ALLOWS 0 TO 2 COMMENTS 🔥
    const BASE = `is:issue is:open no:assignee comments:0..2`;

    const seen       = new Set<number>();
    const repoCounts = new Map<string, number>();
    const allBatches: any[][] = [];
    const labelSets: string[][] = [];

    // FIXED: Added Worldwide logic so feed never stays empty
    if (scope === "gssoc" || scope === "both") labelSets.push(GSSOC_LABELS);
    if (scope === "ssoc"  || scope === "both") labelSets.push(SSOC_LABELS);
    if (scope === "worldwide") labelSets.push(WORLDWIDE_LABELS);

    const promises: Promise<any[]>[] = [];

    for (const labels of labelSets) {
      for (const lbl of labels) {
        const q = `${BASE} ${lbl}${suffix}`;
        promises.push(ghSearch(q, GH_TOKEN, "updated", 1));
        promises.push(ghSearch(q, GH_TOKEN, "created", 1));
      }
    }

    for (const lbl of (labelSets[0] || []).slice(0, 4)) {
      const q = `${BASE} ${lbl}${suffix}`;
      promises.push(ghSearch(q, GH_TOKEN, "updated", 2));
    }

    const results = await Promise.allSettled(promises);
    results.forEach((r) => {
      if (r.status === "fulfilled") allBatches.push(r.value);
    });

    const issues = collect(allBatches, seen, repoCounts);
    issues.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

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
      return NextResponse.json({ error: "rate_limit", resetTime, issues: [] }, { status: 429 });
    }
    console.error("[/api/issues]", msg);
    return NextResponse.json({ error: "fetch_failed", message: msg, issues: [] }, { status: 500 });
  }
} 