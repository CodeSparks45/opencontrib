import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { techStack, experience, interests, githubUsername } = await req.json();

    if (!techStack) {
      return NextResponse.json({ error: "techStack is required" }, { status: 400 });
    }

    // 1. Fetch some real GitHub issues to give Claude context
    const labels = experience === "beginner" ? "good first issue" : "help wanted";
    const langMap: Record<string, string> = {
      react: "javascript",
      typescript: "typescript",
      python: "python",
      java: "java",
      go: "go",
      rust: "rust",
      "c++": "cpp",
    };

    const primaryLang = techStack
      .toLowerCase()
      .split(/[,\s]+/)
      .map((t: string) => t.trim())
      .map((t: string) => langMap[t])
      .find(Boolean) || "";

    const q = `is:issue is:open no:assignee label:"${labels}"${primaryLang ? ` language:${primaryLang}` : ""}`;
    const githubRes = await fetch(
      `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=20`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "gssoc-issue-finder",
        },
      }
    );

    const githubData = await githubRes.json();
    const issues = (githubData.items || []).slice(0, 15);

    if (issues.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    // 2. Format issues for Claude
    const issueList = issues
      .map(
        (issue: any, idx: number) =>
          `${idx + 1}. REPO: ${issue.repository_url.replace("https://api.github.com/repos/", "")}
   TITLE: ${issue.title}
   URL: ${issue.html_url}
   LABELS: ${issue.labels.map((l: any) => l.name).join(", ") || "none"}
   COMMENTS: ${issue.comments}
   BODY_SNIPPET: ${(issue.body || "").slice(0, 200)}`
      )
      .join("\n\n");

    // 3. Call Claude API
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY || "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are an expert open-source contribution advisor for student developers. 
Analyze GitHub issues and match them to a developer's profile.
You MUST respond with ONLY valid JSON — no preamble, no markdown, no explanation.
Return exactly this structure:
{
  "suggestions": [
    {
      "repoName": "owner/repo",
      "issueTitle": "exact issue title",
      "issueUrl": "https://github.com/...",
      "reason": "2-3 sentences explaining why this matches the developer",
      "matchScore": 85,
      "difficulty": "Beginner",
      "skills": ["React", "TypeScript"]
    }
  ]
}
Return 3-5 suggestions, ordered by match quality. difficulty must be one of: Beginner, Intermediate, Hard.`,
        messages: [
          {
            role: "user",
            content: `Developer Profile:
- Tech Stack: ${techStack}
- Experience Level: ${experience}
- Interests: ${interests || "general open source"}
- GitHub Username: ${githubUsername || "unknown"}

Available GitHub Issues:
${issueList}

Pick the 3-5 best matching issues for this developer. Consider their tech stack, experience level, and interests. Give a matchScore from 50-100.`,
          },
        ],
      }),
    });

    if (!claudeRes.ok) {
      const errText = await claudeRes.text();
      console.error("Claude API error:", errText);
      // Fallback: return top 3 issues without AI ranking
      const fallback = issues.slice(0, 3).map((issue: any) => ({
        repoName: issue.repository_url.replace("https://api.github.com/repos/", ""),
        issueTitle: issue.title,
        issueUrl: issue.html_url,
        reason: "This issue matches your experience level and has the right labels for contribution.",
        matchScore: 70,
        difficulty: "Beginner",
        skills: techStack.split(",").map((s: string) => s.trim()).slice(0, 3),
      }));
      return NextResponse.json({ suggestions: fallback });
    }

    const claudeData = await claudeRes.json();
    const rawText = claudeData.content
      ?.filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    // Parse JSON safely
    let parsed;
    try {
      // Strip any potential markdown fences
      const clean = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      // Try to find JSON in the response
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse Claude response");
      }
    }

    return NextResponse.json({ suggestions: parsed.suggestions || [] });
  } catch (error) {
    console.error("AI match error:", error);
    return NextResponse.json(
      { error: "Failed to get AI recommendations" },
      { status: 500 }
    );
  }
}