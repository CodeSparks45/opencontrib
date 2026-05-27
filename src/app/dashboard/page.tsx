"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Search, Filter, BookOpen, CircleDot, Star, GitPullRequest,
  ExternalLink, Bookmark, Zap, Brain, Flame, Clock, StickyNote, X, ChevronRight
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

// ASLI COMPONENTS IMPORT
import SwipeMode from "@/components/SwipeMode";
import AIMatcher from "@/components/AIMatcher";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDifficultyLabel(labels: any[]): { text: string; color: string } {
  const names = labels.map((l) => l.name.toLowerCase());
  if (names.some((n) => n.includes("good first issue") || n.includes("beginner") || n.includes("easy")))
    return { text: "Beginner", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" };
  if (names.some((n) => n.includes("intermediate") || n.includes("medium")))
    return { text: "Intermediate", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" };
  if (names.some((n) => n.includes("hard") || n.includes("complex") || n.includes("advanced")))
    return { text: "Hard", color: "text-red-400 bg-red-400/10 border-red-400/30" };
  return { text: "Open", color: "text-zinc-400 bg-zinc-800 border-zinc-700" };
}

function getAgeLabel(createdAt: string): { text: string; color: string } {
  const created = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - created.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 6)
    return { text: "🔥 Just now", color: "text-orange-400" };
  if (diffHours < 24)
    return { text: `${diffHours}h ago`, color: "text-emerald-400" };
  if (diffDays < 7)
    return { text: `${diffDays}d ago`, color: "text-blue-400" };
  if (diffDays < 30)
    return { text: `${Math.floor(diffDays / 7)}w ago`, color: "text-zinc-400" };
  return { text: `${Math.floor(diffDays / 30)}mo ago`, color: "text-zinc-500" };
}

// ─── Note Modal ───────────────────────────────────────────────────────────────

function NoteModal({
  issue,
  existingNote,
  onSave,
  onClose,
}: {
  issue: any;
  existingNote: string;
  onSave: (note: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(existingNote);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-white text-sm truncate pr-4">{issue.title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add your private note... (e.g. 'Check codebase first', 'Ask mentor about this')"
          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl p-3 text-sm text-zinc-200 placeholder:text-zinc-600 resize-none focus:outline-none focus:border-zinc-500 transition-colors"
          rows={4}
          autoFocus
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => { onSave(text); onClose(); }}
            className="flex-1 bg-white text-black py-2 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-colors"
          >
            Save Note
          </button>
          {existingNote && (
            <button
              onClick={() => { onSave(""); onClose(); }}
              className="px-4 py-2 text-red-400 hover:bg-red-400/10 rounded-xl text-sm transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Issue Card ───────────────────────────────────────────────────────────────

function IssueCard({
  issue,
  isSaved,
  note,
  onToggleSave,
  onNoteClick,
}: {
  issue: any;
  isSaved: boolean;
  note: string;
  onToggleSave: (e: React.MouseEvent, issue: any) => void;
  onNoteClick: (issue: any) => void;
}) {
  const repoName = issue.repository_url.replace("https://api.github.com/repos/", "");
  const difficulty = getDifficultyLabel(issue.labels);
  const age = getAgeLabel(issue.created_at);

  return (
    <a
      href={issue.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-zinc-950/80 border border-zinc-800 hover:border-zinc-500 transition-all duration-200 p-5 rounded-2xl flex flex-col gap-3 group relative hover:shadow-lg hover:shadow-black/30"
    >
      <div className="absolute top-3 right-3 flex gap-1">
        <button
          onClick={(e) => { e.preventDefault(); onNoteClick(issue); }}
          className={`p-1.5 rounded-lg hover:bg-zinc-800 transition-colors ${note ? "text-yellow-400" : "text-zinc-600 group-hover:text-zinc-400"}`}
          title="Add note"
        >
          <StickyNote className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => onToggleSave(e, issue)}
          className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          title={isSaved ? "Unsave" : "Save"}
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? "fill-blue-500 text-blue-500" : "text-zinc-600 group-hover:text-zinc-400"}`} />
        </button>
        <ExternalLink className="w-4 h-4 text-zinc-700 group-hover:text-zinc-400 transition-colors mt-1.5 mr-0.5" />
      </div>

      <div className="flex items-center gap-2 text-sm text-zinc-400 pr-24">
        <BookOpen className="w-4 h-4 min-w-[16px]" />
        <span className="truncate">{repoName}</span>
      </div>

      <h3 className="font-medium text-white group-hover:text-blue-400 transition-colors leading-snug line-clamp-2 text-sm">
        {issue.title}
      </h3>

      {note && (
        <p className="text-xs text-yellow-400/80 bg-yellow-400/5 border border-yellow-400/20 rounded-lg px-2.5 py-1.5 line-clamp-1">
          📝 {note}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 mt-auto">
        <span className={`px-2 py-0.5 text-xs rounded-full border font-medium ${difficulty.color}`}>
          {difficulty.text}
        </span>
        {issue.labels.slice(0, 2).map((lbl: any) => (
          <span key={lbl.id} className="px-2 py-0.5 bg-zinc-800 text-zinc-300 text-xs rounded-full border border-zinc-700 truncate max-w-[110px]">
            {lbl.name}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-500 border-t border-zinc-800/80 pt-3">
        <span className={`flex items-center gap-1 font-medium ${age.color}`}>
          <Clock className="w-3 h-3" />
          {age.text}
        </span>
        <span className="flex items-center gap-1">
          <CircleDot className="w-3 h-3 text-green-500" />
          {issue.comments} comments
        </span>
      </div>
    </a>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() { redirect("/"); },
  });

  const [issues, setIssues] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loadingIssues, setLoadingIssues] = useState(true);
  const [savedIssues, setSavedIssues] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [noteTarget, setNoteTarget] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [label, setLabel] = useState("good first issue");
  const [activeView, setActiveView] = useState<"grid" | "swipe" | "ai">("grid");

  useEffect(() => {
    try {
      const localSaved = localStorage.getItem("gssoc_saved_issues");
      if (localSaved) setSavedIssues(JSON.parse(localSaved));
      const localNotes = localStorage.getItem("gssoc_notes");
      if (localNotes) setNotes(JSON.parse(localNotes));
    } catch {}
  }, []);

  const fetchIssues = useCallback(async () => {
    try {
      setLoadingIssues(true);
      
      // 🎯 THE SNIPER QUERY: is:open, no:assignee, aur sabse important -> comments:0
      let q = `is:issue is:open no:assignee comments:0`;
      
      if (label) q += ` label:"${label}"`;
      if (language) q += ` language:${language}`;
      if (searchQuery) q += ` ${searchQuery}`;
      
      // 🚀 SORT BY 'created', PER_PAGE 100
      const res = await fetch(
        `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=100`
      );
      const data = await res.json();
      
      setIssues(data.items || []);
      setTotalCount(data.total_count || 0);
    } catch (error) {
      console.error("Error fetching issues:", error);
    } finally {
      setLoadingIssues(false);
    }
  }, [searchQuery, language, label]);

  useEffect(() => {
    if (status === "authenticated") fetchIssues();
  }, [status, fetchIssues]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") fetchIssues();
  };

  const toggleSaveIssue = (e: React.MouseEvent, issue: any) => {
    e.preventDefault();
    const isAlreadySaved = savedIssues.some((s) => s.id === issue.id);
    const updated = isAlreadySaved
      ? savedIssues.filter((s) => s.id !== issue.id)
      : [...savedIssues, issue];
    setSavedIssues(updated);
    localStorage.setItem("gssoc_saved_issues", JSON.stringify(updated));
  };

  const saveNote = (issueId: number, note: string) => {
    const updated = { ...notes, [issueId]: note };
    if (!note) delete updated[issueId];
    setNotes(updated);
    localStorage.setItem("gssoc_notes", JSON.stringify(updated));
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div className="animate-pulse text-zinc-400 font-semibold">Loading your workspace...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 md:p-8">
      {noteTarget && (
        <NoteModal
          issue={noteTarget}
          existingNote={notes[noteTarget.id] || ""}
          onSave={(note) => saveNote(noteTarget.id, note)}
          onClose={() => setNoteTarget(null)}
        />
      )}

      <header className="mb-6 flex justify-between items-center max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">OpenContrib Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-0.5">Find your next open-source contribution</p>
        </div>
        <div className="flex items-center gap-3 bg-zinc-900/50 px-4 py-2 rounded-full border border-white/10 shadow-lg">
          <span className="text-sm text-zinc-300 hidden md:block">
            {session?.user?.name}
          </span>
          <img
            src={session?.user?.image || ""}
            className="w-8 h-8 rounded-full border border-zinc-700"
            alt="Profile"
          />
        </div>
      </header>

      <main className="max-w-7xl mx-auto space-y-6">
        
        {/* Navigation Tabs (Top) */}
        <div className="flex gap-2 flex-wrap mb-2">
          {[
            { id: "grid", label: "Issue Feed", icon: <GitPullRequest className="w-4 h-4" /> },
            { id: "swipe", label: "Swipe Mode", icon: <Zap className="w-4 h-4" /> },
            { id: "ai", label: "AI Matcher", icon: <Brain className="w-4 h-4" /> },
          ].map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeView === view.id
                  ? "bg-white text-black"
                  : "bg-zinc-900/40 border border-white/5 text-zinc-300 hover:border-zinc-600"
              }`}
            >
              {view.icon}
              {view.label}
              {view.id === "swipe" && (
                <span className="text-xs bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold leading-none">NEW</span>
              )}
              {view.id === "ai" && (
                <span className="text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded-full font-bold leading-none">AI</span>
              )}
            </button>
          ))}
        </div>

        {/* 🟢 FULL GRID VIEW (Bento Cards + Search + Stats + Feed) */}
        {activeView === "grid" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Swipe Mode Card */}
              <div className="md:col-span-2 bg-zinc-900/40 border border-white/5 rounded-3xl p-8 hover:bg-zinc-900/60 transition-colors group relative overflow-hidden flex flex-col justify-between shadow-xl">
                <div className="absolute -top-10 -right-10 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:scale-110 duration-500 pointer-events-none">
                  <Flame size={200} className="text-orange-500" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2 flex items-center gap-2"><Zap className="text-orange-400"/> Swipe Mode</h2>
                  <p className="text-zinc-400 max-w-sm mb-6">Tinder-style issue browsing. Save what interests you, skip what doesn't. Fast and addictive.</p>
                </div>
                <button 
                  onClick={() => setActiveView("swipe")}
                  className="w-fit bg-white text-black px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.2)] relative z-10"
                >
                  Start Swiping ↗
                </button>
              </div>

              {/* AI Matcher Card */}
              <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-3xl p-8 hover:border-indigo-500/40 transition-colors flex flex-col justify-between shadow-xl">
                <div>
                  <h2 className="text-xl font-bold mb-2 text-indigo-100 flex items-center gap-2"><Brain className="text-purple-400"/> AI Matcher</h2>
                  <p className="text-indigo-200/60 text-sm mb-6">Claude analyzes your tech stack and suggests perfectly matched issues.</p>
                </div>
                <button 
                  onClick={() => setActiveView("ai")}
                  className="w-full bg-indigo-500 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-600 transition-colors shadow-[0_0_20px_rgba(99,102,241,0.3)]"
                >
                  Match Me ✨
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <section className="md:col-span-2 bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-xl flex flex-col gap-4">
                <h2 className="text-base font-semibold flex items-center gap-2">
                  <Search className="w-4 h-4 text-zinc-400" /> Discover Issues
                </h2>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Search by repo (e.g., facebook/react) or keywords..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-zinc-500 transition-colors placeholder:text-zinc-600"
                  />
                </div>
                <div className="flex gap-3 flex-wrap">
                  <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none">
                    <option value="">Any Language</option>
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                    <option value="go">Go</option>
                    <option value="rust">Rust</option>
                  </select>
                  <select value={label} onChange={(e) => setLabel(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-zinc-300 focus:outline-none">
                    <option value="">All Open Issues</option>
                    <option value="good first issue">Good First Issue</option>
                    <option value="bug">Bug</option>
                    <option value="documentation">Documentation</option>
                    <option value="enhancement">Enhancement</option>
                    <option value="help wanted">Help Wanted</option>
                  </select>
                  <button onClick={fetchIssues} className="bg-white text-black px-6 py-2 rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-colors flex items-center gap-2 ml-auto active:scale-95">
                    <Filter className="w-4 h-4" /> Apply
                  </button>
                </div>
              </section>

              <section className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-xl">
                <h2 className="text-base font-semibold flex items-center gap-2 mb-5">
                  <Star className="w-4 h-4 text-zinc-400" /> Your Stats
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-zinc-950/50 p-4 rounded-2xl border border-white/5 border-l-4 border-l-emerald-500">
                    <span className="text-zinc-400 text-sm">Total Issues Found</span>
                    <span className="text-2xl font-black text-emerald-400">
                      {loadingIssues ? "..." : totalCount.toLocaleString()}+
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-zinc-950/50 p-4 rounded-2xl border border-white/5 border-l-4 border-l-blue-500">
                    <span className="text-zinc-400 text-sm">Issues Loaded</span>
                    <span className="text-2xl font-bold text-blue-400">{issues.length}</span>
                  </div>
                  <div className="flex justify-between items-center bg-zinc-950/50 p-4 rounded-2xl border border-white/5 border-l-4 border-l-yellow-500">
                    <span className="text-zinc-400 text-sm">Saved in Vault</span>
                    <span className="text-2xl font-bold text-yellow-400">{savedIssues.length}</span>
                  </div>
                </div>
              </section>
            </div>

            <section className="bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 shadow-xl min-h-[400px]">
              <h2 className="text-base font-semibold flex items-center gap-2 mb-5">
                <GitPullRequest className="w-4 h-4 text-zinc-400" /> Open Source Issues
              </h2>
              {loadingIssues ? (
                <div className="w-full flex justify-center py-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-white" />
                </div>
              ) : issues.length === 0 ? (
                <div className="w-full text-center py-10 text-zinc-500">No issues found. Try changing the filters!</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {issues.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      issue={issue}
                      isSaved={savedIssues.some((s) => s.id === issue.id)}
                      note={notes[issue.id] || ""}
                      onToggleSave={toggleSaveIssue}
                      onNoteClick={(iss) => setNoteTarget(iss)}
                    />
                  ))}
                </div>
              )}
            </section>

            {savedIssues.length > 0 && (
              <section className="bg-zinc-900/40 backdrop-blur-md border border-blue-500/20 rounded-3xl p-6 shadow-xl">
                <h2 className="text-base font-semibold flex items-center gap-2 mb-4">
                  <Bookmark className="w-4 h-4 text-blue-400" /> Saved Issues
                  <span className="ml-auto text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">{savedIssues.length}</span>
                </h2>
                <div className="space-y-2">
                  {savedIssues.map((issue) => {
                    const repoName = issue.repository_url.replace("https://api.github.com/repos/", "");
                    const age = getAgeLabel(issue.created_at);
                    return (
                      <a key={issue.id} href={issue.html_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-zinc-950/50 rounded-xl border border-zinc-800 hover:border-zinc-600 transition-colors group">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-zinc-500 truncate">{repoName}</p>
                          <p className="text-sm text-zinc-200 group-hover:text-blue-400 truncate transition-colors">{issue.title}</p>
                          {notes[issue.id] && <p className="text-xs text-yellow-400/70 truncate mt-0.5">📝 {notes[issue.id]}</p>}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs ${age.color}`}>{age.text}</span>
                          <button onClick={(e) => toggleSaveIssue(e, issue)} className="p-1 hover:bg-red-500/10 rounded-lg transition-colors text-zinc-500 hover:text-red-400">
                            <X className="w-3.5 h-3.5" />
                          </button>
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                        </div>
                      </a>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        {/* 🔴 SWIPE MODE VIEW */}
        {activeView === "swipe" && (
          <div className="max-w-6xl mx-auto animate-in zoom-in-95 duration-300">
            <SwipeMode issues={issues} savedIssues={savedIssues} onToggleSave={toggleSaveIssue} onFetchMore={fetchIssues} loading={loadingIssues} />
          </div>
        )}

        {/* 🟣 AI MATCHER VIEW */}
        {activeView === "ai" && (
          <div className="max-w-3xl mx-auto animate-in zoom-in-95 duration-300">
            <AIMatcher 
              githubUsername={session?.user?.name || ""} 
              onIssueSelect={(issue: any) => {
                setActiveView("grid");
                setSearchQuery(issue.repository_url.replace("https://api.github.com/repos/", "").split("/")[1] || "");
              }} 
            />
          </div>
        )}

      </main>
    </div>
  );
}