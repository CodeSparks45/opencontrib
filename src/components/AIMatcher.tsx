"use client";

import { useState } from "react";
import { Brain, Loader, ExternalLink, BookOpen, Sparkles, RefreshCw } from "lucide-react";

interface AISuggestion {
  repoName: string;
  issueTitle: string;
  issueUrl: string;
  reason: string;
  matchScore: number;
  difficulty: string;
  skills: string[];
}

interface AIMatcherProps {
  githubUsername: string;
  onIssueSelect: (issue: any) => void;
}

export default function AIMatcher({ githubUsername, onIssueSelect }: AIMatcherProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [error, setError] = useState("");
  const [techStack, setTechStack] = useState("");
  const [experience, setExperience] = useState("beginner");
  const [interests, setInterests] = useState("");

  const runMatcher = async () => {
    setLoading(true);
    setError("");
    setSuggestions([]);

    try {
      const res = await fetch("/api/ai-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ techStack, experience, interests, githubUsername }),
      });

      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const difficultyColor: Record<string, string> = {
    Beginner: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
    Intermediate: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
    Hard: "text-red-400 bg-red-400/10 border-red-400/30",
  };

  return (
    <div className="space-y-6">
      {/* Input Panel */}
      <section className="bg-zinc-900/40 backdrop-blur-md border border-purple-500/20 rounded-3xl p-6 shadow-xl">
        <h2 className="text-base font-semibold flex items-center gap-2 mb-5">
          <Brain className="w-5 h-5 text-purple-400" />
          AI Issue Matcher
          <span className="text-xs bg-purple-600/30 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full ml-1">
            Powered by Claude
          </span>
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400 mb-1.5 block">Your Tech Stack</label>
            <input
              type="text"
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              placeholder="e.g., React, TypeScript, Python, Node.js..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-purple-500/50 transition-colors placeholder:text-zinc-600"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">Experience Level</label>
              <select
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-sm text-zinc-300 focus:outline-none"
              >
                <option value="beginner">Beginner (0-1 yr)</option>
                <option value="intermediate">Intermediate (1-3 yr)</option>
                <option value="advanced">Advanced (3+ yr)</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-zinc-400 mb-1.5 block">Interests / Topics</label>
              <input
                type="text"
                value={interests}
                onChange={(e) => setInterests(e.target.value)}
                placeholder="e.g., web, AI, tools, docs..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-purple-500/50 transition-colors placeholder:text-zinc-600"
              />
            </div>
          </div>

          <button
            onClick={runMatcher}
            disabled={loading || !techStack.trim()}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Finding best issues for you...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Find My Perfect Issues
              </>
            )}
          </button>
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-red-400 text-sm flex items-center gap-2">
          <span>⚠️</span> {error}
        </div>
      )}

      {/* Results */}
      {suggestions.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              AI Recommendations ({suggestions.length})
            </h3>
            <button
              onClick={runMatcher}
              className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suggestions.map((suggestion, idx) => (
              <div
                key={idx}
                className="bg-zinc-900/40 border border-zinc-800 hover:border-purple-500/40 rounded-2xl p-5 flex flex-col gap-3 transition-all group"
              >
                {/* Score + Difficulty */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-4 rounded-full ${
                            i < Math.round(suggestion.matchScore / 20)
                              ? "bg-purple-500"
                              : "bg-zinc-700"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-zinc-500">{suggestion.matchScore}% match</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${difficultyColor[suggestion.difficulty] || difficultyColor["Beginner"]}`}>
                    {suggestion.difficulty}
                  </span>
                </div>

                {/* Repo */}
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <BookOpen className="w-3.5 h-3.5" />
                  {suggestion.repoName}
                </div>

                {/* Title */}
                <h4 className="text-sm font-medium text-white group-hover:text-purple-300 transition-colors leading-snug line-clamp-2">
                  {suggestion.issueTitle}
                </h4>

                {/* AI Reason */}
                <p className="text-xs text-zinc-400 bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 leading-relaxed">
                  🤖 {suggestion.reason}
                </p>

                {/* Skills */}
                {suggestion.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {suggestion.skills.map((skill, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full border border-zinc-700">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}

                {/* CTA */}
                <a
                  href={suggestion.issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto flex items-center justify-center gap-2 py-2.5 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-sm font-medium rounded-xl transition-colors active:scale-[0.98]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Issue on GitHub
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empty state when not started */}
      {!loading && suggestions.length === 0 && !error && (
        <div className="text-center py-16 text-zinc-500">
          <Brain className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium">Tell me your skills, I'll find the perfect issues</p>
          <p className="text-sm mt-1 text-zinc-600">Claude will analyze open issues and match them to your profile</p>
        </div>
      )}
    </div>
  );
}