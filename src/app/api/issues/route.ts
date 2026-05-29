import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

const GSSOC_LABEL_VARIANTS = [
  `label:gssoc`,
  `label:"gssoc'26"`,
  `label:gssoc-2026`,
  `label:"GSSoC 2026"`,
  `label:gssoc-ext`,
  `label:"GSSoC-Ext"`,
];

// Token ab function ke andar pass hoga
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
  const res = await fetch(url, { headers: ghHeaders(token), next: { revalidate: 60 } });

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
    // 1. Session fetch karo aur Dynamic Token nikalo
    const session = await getServerSession(authOptions);
    const userToken = (session as any)?.accessToken;
    const GH_TOKEN = userToken || process.env.GITHUB_API_TOKEN || "";

    const { searchParams } = new URL(req.url);
    const scope     = searchParams.get("scope") || "gssoc";
    const language  = searchParams.get("language") || "";
    const label     = searchParams.get("label") || "good first issue";
    const query     = searchParams.get("query") || "";

    const seen  = new Set<number>();
    const all: any[] = [];

    const addIssues = (items: any[]) => {
      for (const issue of items) {
        if (!seen.has(issue.id) && issue.comments === 0 && !issue.assignee) {
          seen.add(issue.id);
          all.push(issue);
        }
      }
    };

    if (scope === "gssoc") {
      const results = await Promise.allSettled(
        GSSOC_LABEL_VARIANTS.map((lbl) => {
          let q = `is:issue is:open no:assignee comments:0 ${lbl}`;
          if (label)    q += ` label:"${label}"`;
          if (language) q += ` language:${language}`;
          if (query)    q += ` ${query}`;
          return searchGitHub(q, GH_TOKEN); // Token pass kiya yahan
        })
      );

      const firstRateLimit = results.find(r => r.status === "rejected" && r.reason?.message?.startsWith("RATE_LIMIT"));
      const allFailed = results.every(r => r.status === "rejected");

      if (allFailed && firstRateLimit) {
        const msg = (firstRateLimit as PromiseRejectedResult).reason.message;
        const resetTime = msg.split(":")[1] || "soon";
        return NextResponse.json({ error: "rate_limit", resetTime, issues: [] }, { status: 429 });
      }

      results.forEach((r) => { if (r.status === "fulfilled") addIssues(r.value); });
    } else {
      let q = `is:issue is:open no:assignee comments:0`;
      if (label)    q += ` label:"${label}"`;
      if (language) q += ` language:${language}`;
      if (query)    q += ` ${query}`;
      const items = await searchGitHub(q, GH_TOKEN); // Token pass kiya yahan
      addIssues(items);
    }

    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return NextResponse.json({ issues: all, total: all.length });

  } catch (err: any) {
    const msg: string = err?.message || "";
    if (msg.startsWith("RATE_LIMIT")) {
      const resetTime = msg.split(":")[1] || "soon";
      return NextResponse.json({ error: "rate_limit", resetTime, issues: [] }, { status: 429 });
    }
    console.error("[/api/issues] Error:", msg);
    return NextResponse.json({ error: "fetch_failed", message: msg, issues: [] }, { status: 500 });
  }
}