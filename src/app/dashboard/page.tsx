"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Search, Filter, BookOpen, CircleDot, GitPullRequest,
  ExternalLink, Bookmark, Zap, Brain, Clock, StickyNote, X,
  ChevronRight, Trophy, Flame, RefreshCw, BarChart2, Award,
} from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import SwipeMode from "@/components/SwipeMode";
import AIMatcher from "@/components/AIMatcher";

// ─── Types ──────────────────────────────────────────────────────────────────
type View = "grid" | "swipe" | "ai" | "leaderboard" | "saved";

// ─── GSSoC Labels — ALL known variants ──────────────────────────────────────
// We run multiple queries and merge results to maximise coverage
const GSSOC_QUERIES = [
  `label:gssoc`,
  `label:"gssoc'26"`,
  `label:gssoc-2026`,
  `label:"GSSoC 2026"`,
  `label:gssoc-ext`,
  `label:"GSSoC-Ext"`,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getDifficulty(labels: any[]) {
  const n = labels.map(l => l.name.toLowerCase());
  if (n.some(x => x.includes("good first issue") || x.includes("beginner") || x.includes("easy")))
    return { text: "Beginner", cls: "diff-beginner" };
  if (n.some(x => x.includes("intermediate") || x.includes("medium")))
    return { text: "Intermediate", cls: "diff-mid" };
  if (n.some(x => x.includes("hard") || x.includes("complex") || x.includes("advanced")))
    return { text: "Hard", cls: "diff-hard" };
  return { text: "Open", cls: "diff-open" };
}

function getAge(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  const d = Math.floor(h / 24);
  if (h < 6) return { text: "🔥 Just now", hot: true };
  if (h < 24) return { text: `${h}h ago`, hot: false };
  if (d < 7) return { text: `${d}d ago`, hot: false };
  return { text: `${Math.floor(d / 7)}w ago`, hot: false };
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Note Modal ───────────────────────────────────────────────────────────────
function NoteModal({ issue, note, onSave, onClose }: {
  issue: any; note: string; onSave: (n: string) => void; onClose: () => void;
}) {
  const [text, setText] = useState(note);
  return (
    <div className="dash-modal-bg" onClick={onClose}>
      <div className="dash-modal" onClick={e => e.stopPropagation()}>
        <div className="dash-modal-head">
          <p className="dash-modal-title">{issue.title}</p>
          <button className="dash-icon-btn" onClick={onClose}><X size={15} /></button>
        </div>
        <textarea
          value={text} onChange={e => setText(e.target.value)}
          placeholder="Add a private note… e.g. 'check codebase first', 'ask mentor about this'"
          className="dash-textarea" rows={4} autoFocus
        />
        <div className="dash-modal-actions">
          <button className="dash-btn-primary" onClick={() => { onSave(text); onClose(); }}>Save Note</button>
          {note && <button className="dash-btn-danger" onClick={() => { onSave(""); onClose(); }}>Clear</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="dash-issue-card" style={{ pointerEvents: "none" }}>
      {[85, 55, 100, 40].map((w, i) => (
        <div key={i} className="dash-skel" style={{ width: `${w}%`, height: i === 2 ? 14 : 10, marginBottom: 8 }} />
      ))}
    </div>
  );
}

// ─── Scan Overlay ─────────────────────────────────────────────────────────────
function ScanOverlay({ phase }: { phase: string }) {
  return (
    <div className="dash-scan-overlay">
      <div className="dash-scan-box">
        <div className="dash-scan-ring" />
        <div className="dash-scan-title">Scanning GitHub</div>
        <div className="dash-scan-phase">{phase}</div>
      </div>
    </div>
  );
}

// ─── Issue Card ───────────────────────────────────────────────────────────────
function IssueCard({ issue, saved, note, onSave, onNote }: any) {
  const repo = issue.repository_url.replace("https://api.github.com/repos/", "");
  const diff = getDifficulty(issue.labels);
  const age = getAge(issue.created_at);

  return (
    <a href={issue.html_url} target="_blank" rel="noopener noreferrer" className="dash-issue-card">
      <div className="dash-card-actions">
        <button onClick={e => { e.preventDefault(); onNote(issue); }}
          className={`dash-icon-btn ${note ? "active-note" : ""}`} title="Note">
          <StickyNote size={13} />
        </button>
        <button onClick={e => { e.preventDefault(); onSave(e, issue); }}
          className={`dash-icon-btn ${saved ? "active-save" : ""}`} title="Save">
          <Bookmark size={13} />
        </button>
        <ExternalLink size={13} className="dash-ext-icon" />
      </div>
      <div className="dash-card-repo"><BookOpen size={11} /><span>{repo}</span></div>
      <h3 className="dash-card-title">{issue.title}</h3>
      {note && <div className="dash-note-preview">📝 {note}</div>}
      <div className="dash-card-badges">
        <span className={`dash-diff-badge ${diff.cls}`}>{diff.text}</span>
        {issue.labels.slice(0, 2).map((l: any) => (
          <span key={l.id} className="dash-label-badge">{l.name}</span>
        ))}
      </div>
      <div className="dash-card-footer">
        <span className={`dash-age ${age.hot ? "hot" : ""}`}><Clock size={11} />{age.text}</span>
        <span className="dash-comments"><CircleDot size={11} color="#4ade80" />{issue.comments} comments</span>
      </div>
    </a>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, accent, sub }: any) {
  return (
    <div className="dash-stat-card">
      <div className="dash-stat-icon" style={{ background: `${accent}15`, border: `1px solid ${accent}30`, color: accent }}>{icon}</div>
      <div>
        <div className="dash-stat-val">{value}</div>
        <div className="dash-stat-label">{label}</div>
        {sub && <div className="dash-stat-sub">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Leaderboard (real users only — no dummy data) ────────────────────────────
function LeaderboardView({ username }: { username: string }) {
  // No hardcoded fake data. We show a "coming soon" with real info.
  return (
    <div className="dash-section">
      <div className="dash-section-head">
        <Trophy size={16} className="dash-accent-icon" />
        <span>Leaderboard</span>
        <span className="dash-section-badge">Coming Soon</span>
      </div>
      <div className="dash-lb-coming">
        <div className="dash-lb-coming-icon">🏆</div>
        <h3 className="dash-lb-coming-title">Real-time Leaderboard</h3>
        <p className="dash-lb-coming-desc">
          We're building a live leaderboard that tracks actual merged PRs from GitHub.
          <br />Your rank will be based on real contributions — no fake scores.
        </p>
        <div className="dash-lb-coming-pill">
          <div className="dash-lb-user-preview">
            <span className="dash-lb-user-dot" />
            {username || "You"} — tracking your PRs soon
          </div>
        </div>
        <p className="dash-lb-coming-note">
          Until then, use the Discover tab to find issues and start contributing!
        </p>
      </div>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { data: session, status } = useSession({
    required: true,
    onUnauthenticated() { redirect("/"); },
  });

  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanPhase, setScanPhase] = useState("");
  const [lastScan, setLastScan] = useState<Date | null>(null);
  const [savedIssues, setSavedIssues] = useState<any[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [noteTarget, setNoteTarget] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [language, setLanguage] = useState("");
  const [label, setLabel] = useState("good first issue");
  const [scope, setScope] = useState("gssoc");
  const [view, setView] = useState<View>("grid");
  const [toast, setToast] = useState("");
const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const [xp, setXp] = useState(650);
  const [streak, setStreak] = useState(7);
  const xpToNext = 1000;
  const hasFetched = useRef(false);

  useEffect(() => {
    try {
      const sv = localStorage.getItem("oc_saved"); if (sv) setSavedIssues(JSON.parse(sv));
      const nt = localStorage.getItem("oc_notes"); if (nt) setNotes(JSON.parse(nt));
      const x = localStorage.getItem("oc_xp"); if (x) setXp(parseInt(x));
      const s = localStorage.getItem("oc_streak"); if (s) setStreak(parseInt(s));
      const ls = localStorage.getItem("oc_last_scan"); if (ls) setLastScan(new Date(ls));
    } catch { }
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) {
  clearTimeout(toastTimer.current);
}
    toastTimer.current = setTimeout(() => setToast(""), 3000);
  };

  // ── Core fetch — multi-query, dedup, zero-comments filter ─────────────────
  const fetchIssues = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setIssues([]);

    try {
      const seen = new Set<number>();
      const all: any[] = [];

      if (scope === "gssoc") {
        // Run all GSSoC label variants in parallel
        setScanPhase("Querying all GSSoC label variants…");

        const labelQueries = GSSOC_QUERIES.map(lbl => {
          let q = `is:issue is:open no:assignee comments:0 ${lbl}`;
          if (label) q += ` label:"${label}"`;
          if (language) q += ` language:${language}`;
          if (searchQuery) q += ` ${searchQuery}`;
          return encodeURIComponent(q);
        });

        setScanPhase("Fetching fresh issues from GitHub…");

        const results = await Promise.allSettled(
          labelQueries.map(q =>
            fetch(`https://api.github.com/search/issues?q=${q}&sort=created&order=desc&per_page=30`)
              .then(r => r.json())
          )
        );

        setScanPhase("Filtering zero-comment unassigned issues…");

        results.forEach(r => {
          if (r.status === "fulfilled" && Array.isArray(r.value.items)) {
            r.value.items.forEach((issue: any) => {
              if (!seen.has(issue.id) && issue.comments === 0 && !issue.assignee) {
                seen.add(issue.id);
                all.push(issue);
              }
            });
          }
        });

      } else {
        // Worldwide — single query, popular repos
        setScanPhase("Scanning global open-source repos…");

        let q = `is:issue is:open no:assignee comments:0`;
        if (label) q += ` label:"${label}"`;
        if (language) q += ` language:${language}`;
        if (searchQuery) q += ` ${searchQuery}`;

        const res = await fetch(
          `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=created&order=desc&per_page=60`
        );
        const data = await res.json();

        setScanPhase("Filtering issues…");

        (data.items || []).forEach((issue: any) => {
          if (!seen.has(issue.id) && issue.comments === 0 && !issue.assignee) {
            seen.add(issue.id);
            all.push(issue);
          }
        });
      }

      // Sort by newest first
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setScanPhase("Done!");
      setIssues(all);

      const now = new Date();
      setLastScan(now);
      localStorage.setItem("oc_last_scan", now.toISOString());

      showToast(`✅ Found ${all.length} fresh issues with 0 comments!`);

    } catch (e) {
      console.error(e);
      showToast("⚠️ Scan failed. Check your network.");
    }

    setLoading(false);
    setScanPhase("");
  }, [searchQuery, language, label, scope, loading]);

  // Auto-fetch on first load
  useEffect(() => {
    if (status === "authenticated" && !hasFetched.current) {
      hasFetched.current = true;
      fetchIssues();
    }
  }, [status]); // eslint-disable-line

  const toggleSave = (e: React.MouseEvent | { preventDefault: () => void }, issue: any) => {
    e.preventDefault();
    const already = savedIssues.some(s => s.id === issue.id);
    const updated = already ? savedIssues.filter(s => s.id !== issue.id) : [...savedIssues, issue];
    setSavedIssues(updated);
    localStorage.setItem("oc_saved", JSON.stringify(updated));
    if (!already) {
      const newXp = xp + 10;
      setXp(newXp); localStorage.setItem("oc_xp", String(newXp));
      showToast("⚡ +10 XP — Issue saved!");
    }
  };

  const saveNote = (id: number, note: string) => {
    const updated = { ...notes, [id]: note };
    if (!note) delete updated[id];
    setNotes(updated);
    localStorage.setItem("oc_notes", JSON.stringify(updated));
  };

  if (status === "loading") return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050810", color: "#F0F4FF", fontFamily: "sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div className="dash-spin" />
        <p style={{ marginTop: 16, color: "rgba(240,244,255,.4)", fontSize: 14 }}>Loading your workspace…</p>
      </div>
    </div>
  );

  const tabs: { id: View; label: string; icon: any; badge?: string }[] = [
    { id: "grid", label: "Discover", icon: <Search size={14} /> },
    { id: "swipe", label: "Swipe", icon: <Zap size={14} />, badge: "HOT" },
    { id: "ai", label: "AI Match", icon: <Brain size={14} />, badge: "AI" },
    { id: "leaderboard", label: "Leaderboard", icon: <Trophy size={14} /> },
    { id: "saved", label: `Saved (${savedIssues.length})`, icon: <Bookmark size={14} /> },
  ];

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@400;500;600&family=Fira+Code:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;}
        :root{
          --bg:#050810;--bg1:#080d1a;--bg2:#0c1220;
          --cyan:#00E5FF;--cdim:rgba(0,229,255,.1);
          --green:#00FFA3;--orange:#FF6B35;--purple:#7C3AED;
          --t1:#F0F4FF;--t2:rgba(240,244,255,.55);--t3:rgba(240,244,255,.25);
          --bd:rgba(255,255,255,.07);--bdh:rgba(0,229,255,.2);
          --fd:'Bricolage Grotesque',system-ui,sans-serif;
          --fb:'Plus Jakarta Sans',system-ui,sans-serif;
          --fm:'Fira Code',monospace;
          --r-sm:10px;--r-md:14px;--r-lg:20px;--r-xl:26px;
        }
        body{background:var(--bg);color:var(--t1);font-family:var(--fb);font-size:14px;line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden;}
        body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(0,229,255,.018) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,.018) 1px,transparent 1px);background-size:52px 52px;pointer-events:none;z-index:0;}
        body::after{content:'';position:fixed;top:-30%;left:50%;transform:translateX(-50%);width:70vw;height:50vh;background:radial-gradient(ellipse,rgba(0,229,255,.055) 0%,transparent 65%);pointer-events:none;z-index:0;}
        .dash-root{position:relative;z-index:1;min-height:100vh;padding:0 0 80px;}

        /* ── TOPBAR ── */
        .dash-topbar{position:sticky;top:0;z-index:100;backdrop-filter:blur(24px);background:rgba(5,8,16,.8);border-bottom:1px solid var(--bd);padding:0 24px;}
        .dash-topbar-inner{max-width:1280px;margin:0 auto;display:flex;align-items:center;gap:16px;height:60px;}
        .dash-logo{display:flex;align-items:center;gap:8px;font-family:var(--fd);font-size:16px;font-weight:700;color:var(--t1);text-decoration:none;flex-shrink:0;}
        .dash-logo-dot{width:8px;height:8px;border-radius:50%;background:var(--cyan);box-shadow:0 0 8px var(--cyan);}
        .dash-topbar-tabs{display:flex;gap:2px;flex:1;overflow-x:auto;scrollbar-width:none;}
        .dash-topbar-tabs::-webkit-scrollbar{display:none;}
        .dash-tab{display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:var(--r-md);font-size:12.5px;font-weight:600;color:var(--t2);cursor:pointer;border:1px solid transparent;white-space:nowrap;transition:all .2s;background:transparent;}
        .dash-tab:hover{color:var(--t1);background:rgba(255,255,255,.04);}
        .dash-tab.active{background:rgba(0,229,255,.08);border-color:var(--bdh);color:var(--cyan);}
        .dash-tab-badge{font-size:9px;font-weight:700;padding:2px 6px;border-radius:99px;background:#ff4e4e;color:#fff;}
        .dash-tab-badge.ai{background:#7C3AED;}
        .dash-topbar-right{display:flex;align-items:center;gap:10px;flex-shrink:0;}
        .dash-streak-pill{display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:99px;background:rgba(251,146,60,.1);border:1px solid rgba(251,146,60,.25);font-size:12px;font-weight:700;color:#fb923c;}
        .dash-xp-pill{display:flex;align-items:center;gap:6px;padding:5px 12px;border-radius:99px;background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.2);font-size:12px;font-weight:700;color:#fbbf24;}
        .dash-avatar{width:30px;height:30px;border-radius:50%;border:2px solid rgba(0,229,255,.3);}

        /* ── MAIN ── */
        .dash-main{max-width:1280px;margin:0 auto;padding:24px 24px 0;}

        /* ── XP BAR ── */
        .dash-xp-bar-wrap{background:var(--bg1);border:1px solid var(--bd);border-radius:var(--r-lg);padding:16px 20px;display:flex;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap;}
        .dash-xp-bar-info{flex:1;min-width:200px;}
        .dash-xp-bar-labels{display:flex;justify-content:space-between;margin-bottom:7px;font-size:11.5px;}
        .dash-xp-bar-level{font-family:var(--fd);font-weight:700;color:var(--cyan);}
        .dash-xp-bar-count{color:var(--t3);}
        .dash-xp-bar-track{height:5px;background:rgba(255,255,255,.06);border-radius:99px;overflow:hidden;}
        .dash-xp-bar-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,var(--cyan),var(--green));transition:width 1s cubic-bezier(.16,1,.3,1);}
        .dash-xp-badges{display:flex;gap:8px;flex-wrap:wrap;}
        .dash-xp-badge{font-size:11px;padding:3px 10px;border-radius:99px;border:1px solid;font-weight:600;}

        /* ── STATS ── */
        .dash-stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px;}
        @media(max-width:900px){.dash-stats-grid{grid-template-columns:repeat(2,1fr);}}
        @media(max-width:500px){.dash-stats-grid{grid-template-columns:1fr;}}
        .dash-stat-card{background:var(--bg1);border:1px solid var(--bd);border-radius:var(--r-lg);padding:16px;display:flex;align-items:center;gap:12px;transition:border-color .2s;}
        .dash-stat-card:hover{border-color:rgba(0,229,255,.12);}
        .dash-stat-icon{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
        .dash-stat-val{font-family:var(--fd);font-size:24px;font-weight:800;line-height:1;color:var(--t1);}
        .dash-stat-label{font-size:11px;color:var(--t3);margin-top:2px;text-transform:uppercase;letter-spacing:.04em;font-weight:600;}
        .dash-stat-sub{font-size:11px;color:var(--t3);margin-top:2px;}

        /* ── SCAN BAR ── */
        .dash-scan-bar{background:var(--bg1);border:1px solid var(--bd);border-radius:var(--r-xl);padding:18px 20px;margin-bottom:20px;}
        .dash-scan-top{display:flex;gap:10px;margin-bottom:14px;align-items:center;flex-wrap:wrap;}
        .dash-search-input-wrap{position:relative;flex:1;min-width:180px;}
        .dash-search-input-wrap svg{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--t3);}
        .dash-search-input{width:100%;background:rgba(255,255,255,.04);border:1px solid var(--bd);border-radius:var(--r-md);padding:10px 14px 10px 38px;color:var(--t1);font-family:var(--fb);font-size:13.5px;outline:none;transition:border-color .2s;}
        .dash-search-input:focus{border-color:var(--bdh);background:rgba(0,229,255,.03);}
        .dash-search-input::placeholder{color:var(--t3);}
        .dash-scope-toggle{display:flex;background:rgba(255,255,255,.04);border:1px solid var(--bd);border-radius:var(--r-md);overflow:hidden;flex-shrink:0;}
        .dash-scope-btn{padding:9px 16px;font-size:12.5px;font-weight:600;cursor:pointer;border:none;background:transparent;color:var(--t2);transition:all .2s;white-space:nowrap;}
        .dash-scope-btn.active{background:rgba(0,229,255,.12);color:var(--cyan);}
        .dash-filters-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;}
        .dash-select{background:rgba(255,255,255,.04);border:1px solid var(--bd);border-radius:var(--r-md);padding:8px 14px;color:var(--t1);font-family:var(--fb);font-size:13px;outline:none;cursor:pointer;transition:border-color .2s;}
        .dash-select:focus{border-color:var(--bdh);}
        .dash-select option{background:var(--bg2);}

        /* ── SCAN BUTTON ── */
        .dash-scan-btn{display:flex;align-items:center;gap:7px;padding:10px 22px;border-radius:var(--r-md);background:linear-gradient(135deg,#00C8EC,#0077FF);color:#000;font-family:var(--fd);font-weight:800;font-size:13px;cursor:pointer;border:none;transition:all .2s;margin-left:auto;white-space:nowrap;position:relative;overflow:hidden;}
        .dash-scan-btn::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.2),transparent);opacity:0;transition:opacity .2s;}
        .dash-scan-btn:hover::after{opacity:1;}
        .dash-scan-btn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(0,180,255,.35);}
        .dash-scan-btn:active{transform:scale(.97);}
        .dash-scan-btn:disabled{opacity:.6;cursor:not-allowed;transform:none;}
        @keyframes dash-spin-ico{to{transform:rotate(360deg)}}
        .spin-ico{animation:dash-spin-ico .7s linear infinite;}

        /* last scan info */
        .dash-last-scan{font-size:11px;color:var(--t3);margin-top:10px;display:flex;align-items:center;gap:6px;}
        .dash-last-scan-dot{width:5px;height:5px;border-radius:50%;background:#4ade80;box-shadow:0 0 6px #4ade80;}

        /* ── SCAN OVERLAY ── */
        .dash-scan-overlay{position:fixed;inset:0;background:rgba(5,8,16,.85);backdrop-filter:blur(12px);z-index:200;display:flex;align-items:center;justify-content:center;}
        .dash-scan-box{text-align:center;}
        .dash-scan-ring{width:60px;height:60px;border:3px solid rgba(0,229,255,.15);border-top-color:var(--cyan);border-radius:50%;animation:dash-spin-ico .8s linear infinite;margin:0 auto 20px;}
        .dash-scan-title{font-family:var(--fd);font-size:20px;font-weight:800;color:var(--t1);margin-bottom:8px;}
        .dash-scan-phase{font-size:13px;color:var(--t2);font-family:var(--fm);}

        /* ── SECTION ── */
        .dash-section{background:var(--bg1);border:1px solid var(--bd);border-radius:var(--r-xl);padding:20px;margin-bottom:20px;}
        .dash-section-head{display:flex;align-items:center;gap:8px;margin-bottom:16px;font-size:13.5px;font-weight:700;color:var(--t1);}
        .dash-accent-icon{color:var(--cyan);}
        .dash-section-badge{margin-left:auto;font-size:11px;padding:3px 10px;border-radius:99px;background:rgba(0,229,255,.08);border:1px solid var(--bdh);color:var(--cyan);font-weight:700;}

        /* ── ISSUE GRID ── */
        .dash-issue-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
        @media(max-width:1024px){.dash-issue-grid{grid-template-columns:repeat(2,1fr);}}
        @media(max-width:640px){.dash-issue-grid{grid-template-columns:1fr;}}
        .dash-issue-card{background:rgba(255,255,255,.02);border:1px solid var(--bd);border-radius:var(--r-lg);padding:16px;display:flex;flex-direction:column;gap:10px;text-decoration:none;position:relative;transition:all .25s cubic-bezier(.16,1,.3,1);overflow:hidden;}
        .dash-issue-card::after{content:'';position:absolute;bottom:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(0,229,255,.25),transparent);opacity:0;transition:opacity .3s;}
        .dash-issue-card:hover{border-color:rgba(0,229,255,.22);transform:translateY(-3px) scale(1.005);box-shadow:0 10px 40px rgba(0,0,0,.5);}
        .dash-issue-card:hover::after{opacity:1;}
        .dash-card-actions{position:absolute;top:10px;right:10px;display:flex;gap:4px;opacity:0;transition:opacity .2s;}
        .dash-issue-card:hover .dash-card-actions{opacity:1;}
        .dash-icon-btn{width:26px;height:26px;border-radius:7px;border:1px solid var(--bd);background:rgba(255,255,255,.04);display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--t3);transition:all .2s;}
        .dash-icon-btn:hover{border-color:var(--bdh);color:var(--cyan);}
        .dash-icon-btn.active-note{color:#fbbf24;border-color:rgba(251,191,36,.3);}
        .dash-icon-btn.active-save{color:#60a5fa;border-color:rgba(96,165,250,.3);}
        .dash-ext-icon{color:var(--t3);margin-left:2px;margin-top:5px;}
        .dash-card-repo{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--t3);font-family:var(--fm);padding-right:80px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .dash-card-title{font-size:13px;font-weight:600;color:var(--t1);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
        .dash-issue-card:hover .dash-card-title{color:rgba(0,229,255,.9);}
        .dash-note-preview{font-size:11px;color:rgba(251,191,36,.8);background:rgba(251,191,36,.05);border:1px solid rgba(251,191,36,.18);border-radius:7px;padding:6px 9px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;}
        .dash-card-badges{display:flex;flex-wrap:wrap;gap:5px;margin-top:auto;}
        .dash-diff-badge{font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:99px;border:1px solid;font-family:var(--fd);}
        .diff-beginner{color:var(--green);background:rgba(0,255,163,.07);border-color:rgba(0,255,163,.25);}
        .diff-mid{color:#fbbf24;background:rgba(251,191,36,.07);border-color:rgba(251,191,36,.25);}
        .diff-hard{color:#f87171;background:rgba(248,113,113,.07);border-color:rgba(248,113,113,.25);}
        .diff-open{color:var(--t3);background:rgba(255,255,255,.04);border-color:var(--bd);}
        .dash-label-badge{font-size:10.5px;padding:2px 8px;border-radius:99px;background:rgba(255,255,255,.05);border:1px solid var(--bd);color:var(--t2);max-width:110px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .dash-card-footer{display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--t3);padding-top:8px;border-top:1px solid rgba(255,255,255,.04);}
        .dash-age{display:flex;align-items:center;gap:4px;font-weight:600;}
        .dash-age.hot{color:#fb923c;}
        .dash-comments{display:flex;align-items:center;gap:4px;}

        /* ── SKELETON ── */
        @keyframes skel-shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        .dash-skel{background:linear-gradient(90deg,var(--bg1) 0%,var(--bg2) 50%,var(--bg1) 100%);background-size:200% 100%;animation:skel-shimmer 1.4s infinite;border-radius:6px;}

        /* ── PROMO CARDS ── */
        .dash-promo-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px;}
        @media(max-width:640px){.dash-promo-grid{grid-template-columns:1fr;}}
        .dash-promo-card{border-radius:var(--r-xl);padding:24px;position:relative;overflow:hidden;cursor:pointer;transition:transform .2s,box-shadow .2s;}
        .dash-promo-card:hover{transform:translateY(-3px);}
        .dash-promo-title{font-family:var(--fd);font-size:20px;font-weight:800;color:var(--t1);margin-bottom:6px;display:flex;align-items:center;gap:8px;}
        .dash-promo-desc{font-size:13px;color:var(--t2);line-height:1.6;margin-bottom:18px;max-width:280px;}
        .dash-promo-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:var(--r-md);font-weight:700;font-size:13px;cursor:pointer;border:none;transition:all .2s;}

        /* ── LEADERBOARD COMING SOON ── */
        .dash-lb-coming{text-align:center;padding:48px 24px;}
        .dash-lb-coming-icon{font-size:52px;margin-bottom:16px;}
        .dash-lb-coming-title{font-family:var(--fd);font-size:22px;font-weight:800;color:var(--t1);margin-bottom:10px;}
        .dash-lb-coming-desc{font-size:13.5px;color:var(--t2);line-height:1.75;margin-bottom:20px;}
        .dash-lb-coming-pill{display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:99px;background:rgba(0,229,255,.07);border:1px solid rgba(0,229,255,.2);margin-bottom:16px;}
        .dash-lb-user-preview{font-size:13px;color:var(--cyan);font-weight:600;display:flex;align-items:center;gap:6px;}
        .dash-lb-user-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;box-shadow:0 0 7px #4ade80;}
        .dash-lb-coming-note{font-size:12px;color:var(--t3);}

        /* ── SAVED ── */
        .dash-saved-list{display:flex;flex-direction:column;gap:8px;}
        .dash-saved-row{display:flex;align-items:center;gap:12px;padding:12px;border-radius:var(--r-md);border:1px solid var(--bd);background:rgba(255,255,255,.02);text-decoration:none;transition:all .2s;}
        .dash-saved-row:hover{border-color:rgba(0,229,255,.18);transform:translateY(-1px);}
        .dash-saved-info{flex:1;min-width:0;}
        .dash-saved-repo{font-size:10.5px;color:var(--t3);font-family:var(--fm);}
        .dash-saved-title{font-size:13px;font-weight:600;color:var(--t1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .dash-saved-row:hover .dash-saved-title{color:rgba(0,229,255,.9);}
        .dash-saved-note{font-size:11px;color:rgba(251,191,36,.7);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .dash-saved-actions{display:flex;align-items:center;gap:8px;flex-shrink:0;}

        /* ── MODAL ── */
        .dash-modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.7);backdrop-filter:blur(8px);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px;}
        .dash-modal{background:var(--bg2);border:1px solid rgba(0,229,255,.2);border-radius:var(--r-xl);padding:24px;width:100%;max-width:440px;box-shadow:0 20px 60px rgba(0,0,0,.6);}
        .dash-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:14px;}
        .dash-modal-title{font-size:13px;font-weight:600;color:var(--t1);line-height:1.45;}
        .dash-textarea{width:100%;background:rgba(255,255,255,.04);border:1px solid var(--bd);border-radius:var(--r-md);padding:12px;color:var(--t1);font-family:var(--fb);font-size:13px;resize:none;outline:none;transition:border-color .2s;}
        .dash-textarea:focus{border-color:var(--bdh);}
        .dash-modal-actions{display:flex;gap:8px;margin-top:12px;}
        .dash-btn-primary{flex:1;background:linear-gradient(135deg,var(--cyan),#0088ff);color:#000;border:none;border-radius:var(--r-md);padding:10px;font-weight:700;font-size:13px;cursor:pointer;transition:all .2s;font-family:var(--fd);}
        .dash-btn-primary:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(0,200,255,.3);}
        .dash-btn-danger{padding:10px 16px;border-radius:var(--r-md);background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.25);color:#f87171;font-size:13px;cursor:pointer;font-weight:600;transition:all .2s;}
        .dash-btn-danger:hover{background:rgba(248,113,113,.2);}

        /* ── TOAST ── */
        .dash-toast{position:fixed;bottom:28px;right:28px;z-index:1000;background:var(--bg2);border:1px solid rgba(0,229,255,.25);border-radius:var(--r-lg);padding:12px 18px;font-size:13px;font-weight:600;color:var(--t1);box-shadow:0 10px 40px rgba(0,0,0,.5);animation:dash-toast-in .35s cubic-bezier(.16,1,.3,1);display:flex;align-items:center;gap:8px;max-width:340px;}
        @keyframes dash-toast-in{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}

        /* ── SPIN ── */
        @keyframes dash-spin{to{transform:rotate(360deg)}}
        .dash-spin{width:36px;height:36px;border:2px solid rgba(255,255,255,.1);border-top-color:var(--cyan);border-radius:50%;animation:dash-spin .7s linear infinite;margin:0 auto;}

        /* ── EMPTY STATE ── */
        .dash-empty{text-align:center;padding:60px 20px;color:var(--t3);}
        .dash-empty-icon{font-size:48px;margin-bottom:12px;opacity:.3;}
        .dash-empty p{font-size:14px;line-height:1.7;}
      `}} />

      <div className="dash-root">
        {/* Scan overlay */}
        {loading && scanPhase && <ScanOverlay phase={scanPhase} />}

        {/* Note Modal */}
        {noteTarget && (
          <NoteModal issue={noteTarget} note={notes[noteTarget.id] || ""}
            onSave={n => saveNote(noteTarget.id, n)} onClose={() => setNoteTarget(null)} />
        )}

        {/* Toast */}
        {toast && <div className="dash-toast">{toast}</div>}

        {/* ── TOPBAR ── */}
        <div className="dash-topbar">
          <div className="dash-topbar-inner">
            <a className="dash-logo" href="/"><div className="dash-logo-dot" />OpenContrib</a>
            <div className="dash-topbar-tabs">
              {tabs.map(t => (
                <button key={t.id} className={`dash-tab ${view === t.id ? "active" : ""}`} onClick={() => setView(t.id)}>
                  {t.icon}{t.label}
                  {t.badge && <span className={`dash-tab-badge ${t.badge === "AI" ? "ai" : ""}`}>{t.badge}</span>}
                </button>
              ))}
            </div>
            <div className="dash-topbar-right">
              <div className="dash-streak-pill"><Flame size={13} />🔥 {streak}d</div>
              <div className="dash-xp-pill"><Zap size={12} />⚡ {xp.toLocaleString()} XP</div>
              <img src={session?.user?.image || ""} alt="" className="dash-avatar" title={session?.user?.name || ""} />
            </div>
          </div>
        </div>

        <div className="dash-main">

          {/* ── DISCOVER VIEW ── */}
          {view === "grid" && (
            <>
              {/* XP bar */}
              <div className="dash-xp-bar-wrap">
                <div className="dash-xp-bar-info">
                  <div className="dash-xp-bar-labels">
                    <span className="dash-xp-bar-level">Level 12 · {session?.user?.name?.split(" ")[0]}</span>
                    <span className="dash-xp-bar-count">{xp} / {xpToNext} XP</span>
                  </div>
                  <div className="dash-xp-bar-track">
                    <div className="dash-xp-bar-fill" style={{ width: `${(xp / xpToNext) * 100}%` }} />
                  </div>
                </div>
                <div className="dash-xp-badges">
                  {[
                    { label: `🔥 ${streak}d Streak`, col: "#fb923c", bg: "rgba(251,146,60,.1)", bd: "rgba(251,146,60,.25)" },
                    { label: "⚡ Active", col: "#fbbf24", bg: "rgba(251,191,36,.08)", bd: "rgba(251,191,36,.2)" },
                    { label: "✦ Contributor", col: "#a78bfa", bg: "rgba(167,139,250,.08)", bd: "rgba(167,139,250,.2)" },
                  ].map(b => (
                    <span key={b.label} className="dash-xp-badge" style={{ color: b.col, background: b.bg, borderColor: b.bd }}>{b.label}</span>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="dash-stats-grid">
                <StatCard icon={<GitPullRequest size={16} />} label="Issues Found" value={issues.length} accent="#00E5FF" sub="0-comment only" />
                <StatCard icon={<Bookmark size={16} />} label="Saved" value={savedIssues.length} accent="#60a5fa" sub="in vault" />
                <StatCard icon={<Flame size={16} />} label="Streak" value={`${streak}d`} accent="#fb923c" sub="keep going!" />
                <StatCard icon={<Award size={16} />} label="XP" value={xp.toLocaleString()} accent="#fbbf24" sub={`${xpToNext - xp} to lv 13`} />
              </div>

              {/* Promo cards */}
              <div className="dash-promo-grid">
                <div className="dash-promo-card"
                  style={{ background: "linear-gradient(135deg,rgba(255,107,53,.1),rgba(255,45,120,.06))", border: "1px solid rgba(255,107,53,.2)" }}
                  onClick={() => setView("swipe")}>
                  <div className="dash-promo-title"><Zap size={20} color="#fb923c" />Swipe Mode</div>
                  <div className="dash-promo-desc">Tinder-style issue discovery. Swipe right to save, left to skip. Fast &amp; addictive.</div>
                  <button className="dash-promo-btn" style={{ background: "rgba(255,107,53,.15)", color: "#fb923c", border: "1px solid rgba(255,107,53,.3)" }}>Start Swiping →</button>
                </div>
                <div className="dash-promo-card"
                  style={{ background: "linear-gradient(135deg,rgba(124,58,237,.1),rgba(0,229,255,.04))", border: "1px solid rgba(124,58,237,.25)" }}
                  onClick={() => setView("ai")}>
                  <div className="dash-promo-title"><Brain size={20} color="#a78bfa" />AI Matcher</div>
                  <div className="dash-promo-desc">Claude reads your stack and finds the perfect issues for your exact skill level.</div>
                  <button className="dash-promo-btn" style={{ background: "rgba(124,58,237,.15)", color: "#a78bfa", border: "1px solid rgba(124,58,237,.3)" }}>Match Me ✨</button>
                </div>
              </div>

              {/* Scan bar */}
              <div className="dash-scan-bar">
                <div className="dash-scan-top">
                  <div className="dash-search-input-wrap">
                    <Search size={14} />
                    <input type="text" value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && fetchIssues()}
                      placeholder="Search by repo (e.g. facebook/react) or keywords…"
                      className="dash-search-input" />
                  </div>
                  <div className="dash-scope-toggle">
                    <button className={`dash-scope-btn ${scope === "gssoc" ? "active" : ""}`} onClick={() => setScope("gssoc")}>🎯 GSSoC</button>
                    <button className={`dash-scope-btn ${scope === "worldwide" ? "active" : ""}`} onClick={() => setScope("worldwide")}>🌍 Worldwide</button>
                  </div>
                </div>
                <div className="dash-filters-row">
                  <select value={language} onChange={e => setLanguage(e.target.value)} className="dash-select">
                    <option value="">Any Language</option>
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                    <option value="go">Go</option>
                    <option value="rust">Rust</option>
                    <option value="ruby">Ruby</option>
                    <option value="swift">Swift</option>
                  </select>
                  <select value={label} onChange={e => setLabel(e.target.value)} className="dash-select">
                    <option value="">All Open Issues</option>
                    <option value="good first issue">Good First Issue</option>
                    <option value="bug">Bug</option>
                    <option value="documentation">Documentation</option>
                    <option value="enhancement">Enhancement</option>
                    <option value="help wanted">Help Wanted</option>
                    <option value="beginner">Beginner</option>
                  </select>
                  <button className="dash-scan-btn" onClick={fetchIssues} disabled={loading}>
                    <RefreshCw size={13} className={loading ? "spin-ico" : ""} />
                    {loading ? "Scanning…" : "Scan Fresh Issues"}
                  </button>
                </div>
                {lastScan && !loading && (
                  <div className="dash-last-scan">
                    <div className="dash-last-scan-dot" />
                    Last scan: {fmtTime(lastScan)} · {issues.length} zero-comment issues found
                  </div>
                )}
              </div>

              {/* Issue feed */}
              <div className="dash-section">
                <div className="dash-section-head">
                  <GitPullRequest size={15} className="dash-accent-icon" />
                  Fresh Issues (0 comments · unassigned)
                  <span className="dash-section-badge">
                    {loading ? "Scanning…" : `${issues.length} results`}
                  </span>
                </div>
                {loading ? (
                  <div className="dash-issue-grid">{[...Array(9)].map((_, i) => <SkeletonCard key={i} />)}</div>
                ) : issues.length === 0 ? (
                  <div className="dash-empty">
                    <div className="dash-empty-icon">🔍</div>
                    <p>No fresh issues found yet.<br />Hit <strong>Scan Fresh Issues</strong> to search GitHub in real-time.</p>
                  </div>
                ) : (
                  <div className="dash-issue-grid">
                    {issues.map(issue => (
                      <IssueCard key={issue.id} issue={issue}
                        saved={savedIssues.some(s => s.id === issue.id)}
                        note={notes[issue.id] || ""}
                        onSave={toggleSave}
                        onNote={setNoteTarget} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── SWIPE VIEW ── */}
          {view === "swipe" && (
            <SwipeMode issues={issues} savedIssues={savedIssues}
              onToggleSave={toggleSave} onFetchMore={fetchIssues} loading={loading} />
          )}

          {/* ── AI VIEW ── */}
          {view === "ai" && (
            <AIMatcher
              githubUsername={session?.user?.name || ""}
              onIssueSelect={(issue: any) => {
                setView("grid");
                setSearchQuery(issue.repository_url.replace("https://api.github.com/repos/", "").split("/")[1] || "");
              }} />
          )}

          {/* ── LEADERBOARD VIEW ── */}
          {view === "leaderboard" && <LeaderboardView username={session?.user?.name || ""} />}

          {/* ── SAVED VIEW ── */}
          {view === "saved" && (
            <div className="dash-section">
              <div className="dash-section-head">
                <Bookmark size={15} className="dash-accent-icon" />
                Saved Issues
                <span className="dash-section-badge">{savedIssues.length} saved</span>
              </div>
              {savedIssues.length === 0 ? (
                <div className="dash-empty">
                  <div className="dash-empty-icon">📌</div>
                  <p>No saved issues yet.<br />Browse the Discover tab and bookmark what interests you.</p>
                </div>
              ) : (
                <div className="dash-saved-list">
                  {savedIssues.map(issue => {
                    const repo = issue.repository_url.replace("https://api.github.com/repos/", "");
                    const age = getAge(issue.created_at);
                    return (
                      <a key={issue.id} href={issue.html_url} target="_blank" rel="noopener noreferrer" className="dash-saved-row">
                        <div className="dash-saved-info">
                          <div className="dash-saved-repo">{repo}</div>
                          <div className="dash-saved-title">{issue.title}</div>
                          {notes[issue.id] && <div className="dash-saved-note">📝 {notes[issue.id]}</div>}
                        </div>
                        <div className="dash-saved-actions">
                          <span style={{ fontSize: 11, color: age.hot ? "#fb923c" : "var(--t3)" }}>{age.text}</span>
                          <button className="dash-icon-btn" onClick={e => { e.preventDefault(); setNoteTarget(issue); }}><StickyNote size={12} /></button>
                          <button className="dash-icon-btn" onClick={e => toggleSave(e, issue)}><X size={12} /></button>
                          <ChevronRight size={13} color="var(--t3)" />
                        </div>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}