import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export const dynamic = 'force-dynamic';

const GSSOC_LABEL_VARIANTS = [
  `label:gssoc`,
  `label:"gssoc'26"`,
  `label:gssoc-2026`,
  `label:"GSSoC 2026"`,
  `label:gssoc-ext`,
  `label:"GSSoC-Ext"`,
];

function ghHeaders(token: string) {
  const h: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function searchGitHub(q: string, token: string) {
  const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=40`;
  const res = await fetch(url, { headers: ghHeaders(token), cache: 'no-store' });

  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get("X-RateLimit-Reset");
    const resetTime = reset ? new Date(parseInt(reset) * 1000).toLocaleTimeString() : "soon";
    throw new Error(`RATE_LIMIT:${resetTime}`);
  }
  if (!res.ok) throw new Error(`GITHUB_ERROR:${res.status}`);

  const data = await res.json();
  if (data.message && !data.items) {
    if (data.message.toLowerCase().includes("rate limit")) throw new Error("RATE_LIMIT:soon");
    throw new Error(`GITHUB_MSG:${data.message}`);
  }
  return (data.items || []) as any[];
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userToken = (session as any)?.accessToken;
    const GH_TOKEN = userToken || process.env.GITHUB_API_TOKEN || "";

    const { searchParams } = new URL(req.url);
    const scope     = searchParams.get("scope") || "gssoc";
    const language  = searchParams.get("language") || "";
    const label     = searchParams.get("label") || "";
    const query     = searchParams.get("query") || "";

    // Agar SSOC hai toh backend ko kuch karne ki zaroorat nahi hai
    if (scope === "ssoc") {
      return NextResponse.json({ issues: [], total: 0 });
    }

    const seen  = new Set<number>();
    const all: any[] = [];

    // 🚨 STRICT 2 DAYS (48 HOURS) LIMIT 🚨
    const d = new Date();
    d.setDate(d.getDate() - 2);
    const sinceDate = d.toISOString().split('T')[0];

    const addIssues = (items: any[]) => {
      for (const issue of items) {
        if (!seen.has(issue.id) && !issue.assignee && !issue.pull_request) {
          seen.add(issue.id);
          all.push(issue);
        }
      }
    };

    // 1st PRIORITY: GSSoC
    if (scope === "gssoc") {
      const results = await Promise.allSettled(
        GSSOC_LABEL_VARIANTS.map((lbl) => {
          let q = `is:issue is:open no:assignee created:>=${sinceDate} ${lbl}`;
          if (language) q += ` language:${language}`;
          if (query)    q += ` ${query}`;
          return searchGitHub(q, GH_TOKEN);
        })
      );
      results.forEach((r) => { if (r.status === "fulfilled") addIssues(r.value); });
    }

    // 2nd PRIORITY / FALLBACK: Worldwide (0 Comments Strict)
    if (all.length === 0 || scope === "worldwide") {
      let q = `is:issue is:open no:assignee comments:0 created:>=${sinceDate}`;
      if (label)    q += ` label:"${label}"`;
      else          q += ` label:"good first issue"`;
      if (language) q += ` language:${language}`;
      if (query)    q += ` ${query}`;

      const items = await searchGitHub(q, GH_TOKEN);
      addIssues(items);
    }

    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return NextResponse.json({ issues: all.slice(0, 40), total: all.length });

  } catch (err: any) {
    const msg: string = err?.message || "";
    if (msg.startsWith("RATE_LIMIT")) {
      const resetTime = msg.split(":")[1] || "soon";
      return NextResponse.json({ error: "rate_limit", resetTime, issues: [] }, { status: 429 });
    }
    return NextResponse.json({ error: "fetch_failed", message: msg, issues: [] }, { status: 500 });
  }
}