import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// ─── All GSSoC label variants we know about ──────────────────────────────────
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

// ─── Build request headers ────────────────────────────────────────────────────
function ghHeaders(token: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// ─── Single GitHub search call ────────────────────────────────────────────────
async function ghSearch(q: string, sort: string, page: number, token: string): Promise<any[]> {
  const url =
    `https://api.github.com/search/issues` +
    `?q=${encodeURIComponent(q)}` +
    `&sort=${sort}` +
    `&order=desc` +
    `&per_page=100` + // Fetching 100 for deep dive
    `&page=${page}` +
    `&_=${Date.now()}`; // cache-buster

  const res = await fetch(url, {
    headers: ghHeaders(token),
    cache: "no-store",
  });

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

// ─── Main handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    // Token resolution: client header → session → env fallback
    const authHeader = req.headers.get("authorization");
    const clientToken = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    const session = await getServerSession(authOptions);
    const userToken = (session as any)?.accessToken;
    const GH_TOKEN = clientToken || userToken || process.env.GITHUB_API_TOKEN || "";

    const { searchParams } = new URL(req.url);
    const scope    = searchParams.get("scope")    || "gssoc";
    const language = searchParams.get("language") || "";
    const label    = searchParams.get("label")    || "";
    const query    = searchParams.get("query")    || "";

    // SSOC — not integrated yet
    if (scope === "ssoc") {
      return NextResponse.json({ issues: [], total: 0 });
    }

    // ── Dedup set ────────────────────────────────────────────────────────────
    const seen = new Set<number>();
    const all: any[] = [];
    
    // Max 3 issues per repository to stop other spammers
    const repoCounts = new Map<string, number>();
    const MAX_PER_REPO = 3;

    const addIssues = (items: any[]) => {
      for (const issue of items) {
        // Only unassigned, non-PR items
        if (!seen.has(issue.id) && !issue.assignee && !issue.pull_request) {
          
          const repoUrl = issue.repository_url;
          const currentCount = repoCounts.get(repoUrl) || 0;

          if (currentCount < MAX_PER_REPO) {
            seen.add(issue.id);
            all.push(issue);
            repoCounts.set(repoUrl, currentCount + 1);
          }
        }
      }
    };

    // ── Build suffix shared across queries ───────────────────────────────────
    
    // 🚨 THE ULTIMATE SPAMMER BAN HAMMER 🚨
    // Agar koi aur pareshan kare, toh usko is list mein daal dena.
    const BANNED_USERS = ["JhaSourav07"]; 
    
    // Github will completely ignore these users' issues!
    let suffix = " " + BANNED_USERS.map(u => `-user:${u}`).join(" ");

    if (language) suffix += ` language:${language}`;
    if (query)    suffix += ` ${query}`;

    // ── Strategy: rotate page based on time so each scan gets different slice ─
    // Every 30 seconds → different page (1, 2, or 3) so results rotate
    const rotatingPage = (Math.floor(Date.now() / 30000) % 3) + 1;

    if (scope === "gssoc") {
      // ── Strategy 1: Run ALL gssoc label variants with "updated" sort ────────
      const updatedQueries = GSSOC_LABELS.map((lbl) => {
        const q = `is:issue is:open no:assignee comments:0 ${lbl}${suffix}`; 
        return ghSearch(q, "updated", 1, GH_TOKEN);
      });

      // ── Strategy 2: Same variants but "created" sort, rotating page ──────────
      const createdQueries = GSSOC_LABELS.slice(0, 4).map((lbl) => {
        const q = `is:issue is:open no:assignee comments:0 ${lbl}${suffix}`; 
        return ghSearch(q, "created", rotatingPage, GH_TOKEN);
      });

      // ── Strategy 3: With specific label filter if user selected one ──────────
      const labelQueries = label
        ? GSSOC_LABELS.slice(0, 3).map((lbl) => {
            const q = `is:issue is:open no:assignee comments:0 ${lbl} label:"${label}"${suffix}`; 
            return ghSearch(q, "updated", 1, GH_TOKEN);
          })
        : [];

      // Run all in parallel, ignore individual failures
      const allResults = await Promise.allSettled([
        ...updatedQueries,
        ...createdQueries,
        ...labelQueries,
      ]);

      allResults.forEach((r) => {
        if (r.status === "fulfilled") addIssues(r.value);
      });

      // ── Fallback: if GSSoC queries return nothing, widen search ─────────────
      if (all.length === 0) {
        const fallbackQ = `is:issue is:open no:assignee comments:0 label:"good first issue"${suffix}`; 
        const fb = await ghSearch(fallbackQ, "updated", 1, GH_TOKEN).catch(() => []);
        addIssues(fb);
      }

    } else {
      // ── Worldwide scope ──────────────────────────────────────────────────────
      const effectiveLabel = label || "good first issue";

      // Run parallel queries with different sorts + rotating page for variety
      const wwQueries = [
        ghSearch(
          `is:issue is:open no:assignee comments:0 label:"${effectiveLabel}"${suffix}`,
          "updated",
          1,
          GH_TOKEN
        ),
        ghSearch(
          `is:issue is:open no:assignee comments:0 label:"${effectiveLabel}"${suffix}`,
          "created",
          rotatingPage,
          GH_TOKEN
        ),
      ];

      const wwResults = await Promise.allSettled(wwQueries);
      wwResults.forEach((r) => {
        if (r.status === "fulfilled") addIssues(r.value);
      });
    }

    // ── Sort: mix updated + created so feed feels alive ──────────────────────
    all.sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    // ── Return up to 60 issues ────────────────────────────────────────────────
    const final = all.slice(0, 60);

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
    console.error("[/api/issues]", err);
    return NextResponse.json(
      { error: "fetch_failed", message: msg, issues: [] },
      { status: 500 }
    );
  }
}