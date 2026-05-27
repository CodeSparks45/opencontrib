"use client";

import { useState, useRef } from "react";
import { BookOpen, Clock, CircleDot, Check, X, RefreshCw, Zap } from "lucide-react";

function getAgeLabel(createdAt: string): { text: string; color: string } {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);
  if (diffHours < 6) return { text: "🔥 Just now", color: "text-orange-400" };
  if (diffHours < 24) return { text: `${diffHours}h ago`, color: "text-emerald-400" };
  if (diffDays < 7) return { text: `${diffDays}d ago`, color: "text-blue-400" };
  return { text: `${Math.floor(diffDays / 7)}w ago`, color: "text-zinc-400" };
}

interface SwipeModeProps {
  issues: any[];
  savedIssues: any[];
  onToggleSave: (e: any, issue: any) => void;
  onFetchMore: () => void;
  loading: boolean;
}

export default function SwipeMode({ issues, savedIssues, onToggleSave, onFetchMore, loading }: SwipeModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDir, setSwipeDir] = useState<"left" | "right" | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [saved, setSaved] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  // Touch/drag state
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const currentIssue = issues[currentIndex];

  const handleSwipe = (dir: "left" | "right") => {
    setSwipeDir(dir);
    if (dir === "right") {
      setSaved((prev) => prev + 1);
      if (currentIssue) {
        onToggleSave({ preventDefault: () => {} }, currentIssue);
      }
    } else {
      setSkipped((prev) => prev + 1);
    }
    setTimeout(() => {
      setSwipeDir(null);
      setCurrentIndex((prev) => prev + 1);
      setDragOffset(0);
    }, 300);
  };

  // Drag handlers
  const onMouseDown = (e: React.MouseEvent) => {
    dragStart.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragStart.current) return;
    const offset = e.clientX - dragStart.current.x;
    setDragOffset(offset);
  };
  const onMouseUp = (e: React.MouseEvent) => {
    if (!dragStart.current) return;
    const offset = e.clientX - dragStart.current.x;
    if (offset > 80) handleSwipe("right");
    else if (offset < -80) handleSwipe("left");
    else setDragOffset(0);
    dragStart.current = null;
  };

  const onTouchStart = (e: React.TouchEvent) => {
    dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragStart.current) return;
    const offset = e.touches[0].clientX - dragStart.current.x;
    setDragOffset(offset);
  };
  const onTouchEnd = () => {
    if (!dragStart.current) return;
    if (dragOffset > 80) handleSwipe("right");
    else if (dragOffset < -80) handleSwipe("left");
    else setDragOffset(0);
    dragStart.current = null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-white" />
      </div>
    );
  }

  if (currentIndex >= issues.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-20">
        <div className="text-6xl">🎉</div>
        <div className="text-center">
          <h3 className="text-xl font-bold text-white mb-2">You've seen all issues!</h3>
          <p className="text-zinc-400 text-sm">
            {saved} saved · {skipped} skipped
          </p>
        </div>
        <button
          onClick={() => { setCurrentIndex(0); setSkipped(0); setSaved(0); onFetchMore(); }}
          className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-semibold hover:bg-zinc-200 transition-colors active:scale-95"
        >
          <RefreshCw className="w-4 h-4" />
          Load More Issues
        </button>
      </div>
    );
  }

  const rotationDeg = dragOffset / 15;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Header */}
      <div className="w-full max-w-md flex justify-between items-center px-2">
        <div className="text-center">
          <p className="text-2xl font-bold text-red-400">{skipped}</p>
          <p className="text-xs text-zinc-500">Skipped</p>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 text-sm">
          <Zap className="w-4 h-4 text-orange-400" />
          Swipe Mode
          <span className="text-zinc-600">
            {currentIndex + 1}/{issues.length}
          </span>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-emerald-400">{saved}</p>
          <p className="text-xs text-zinc-500">Saved</p>
        </div>
      </div>

      {/* Card Stack */}
      <div className="relative w-full max-w-md" style={{ height: 420 }}>
        {/* Background preview card */}
        {issues[currentIndex + 1] && (
          <div className="absolute inset-0 top-4 scale-95 opacity-50 bg-zinc-900 border border-zinc-700 rounded-3xl pointer-events-none" />
        )}

        {/* Main card */}
        {currentIssue && (
          <div
            ref={cardRef}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            style={{
              transform: swipeDir === "right"
                ? "translateX(150%) rotate(20deg)"
                : swipeDir === "left"
                ? "translateX(-150%) rotate(-20deg)"
                : `translateX(${dragOffset}px) rotate(${rotationDeg}deg)`,
              transition: swipeDir ? "transform 0.3s ease" : "none",
              cursor: "grab",
            }}
            className="absolute inset-0 bg-zinc-900 border border-zinc-700 rounded-3xl p-7 flex flex-col gap-4 select-none active:cursor-grabbing shadow-2xl"
          >
            {/* Swipe hint overlays */}
            {dragOffset > 40 && (
              <div className="absolute top-6 left-6 bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 font-bold text-lg px-4 py-2 rounded-xl rotate-[-12deg]">
                SAVE ✓
              </div>
            )}
            {dragOffset < -40 && (
              <div className="absolute top-6 right-6 bg-red-500/20 border-2 border-red-500 text-red-400 font-bold text-lg px-4 py-2 rounded-xl rotate-[12deg]">
                SKIP ✗
              </div>
            )}

            {/* Repo */}
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <BookOpen className="w-4 h-4" />
              <span className="truncate">
                {currentIssue.repository_url.replace("https://api.github.com/repos/", "")}
              </span>
            </div>

            {/* Title */}
            <h3 className="text-lg font-bold text-white leading-snug flex-1">
              {currentIssue.title}
            </h3>

            {/* Labels */}
            <div className="flex flex-wrap gap-2">
              {currentIssue.labels.slice(0, 4).map((lbl: any) => (
                <span
                  key={lbl.id}
                  className="px-3 py-1 bg-zinc-800 text-zinc-300 text-xs rounded-full border border-zinc-700"
                >
                  {lbl.name}
                </span>
              ))}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center text-xs text-zinc-500 border-t border-zinc-800 pt-4 mt-2">
              <span className={`flex items-center gap-1 ${getAgeLabel(currentIssue.created_at).color}`}>
                <Clock className="w-3.5 h-3.5" />
                {getAgeLabel(currentIssue.created_at).text}
              </span>
              <span className="flex items-center gap-1">
                <CircleDot className="w-3.5 h-3.5 text-green-500" />
                {currentIssue.comments} comments
              </span>
            </div>

            {/* Instruction hint */}
            <p className="text-center text-xs text-zinc-600">
              ← Skip &nbsp;&nbsp;|&nbsp;&nbsp; Save →
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-6">
        <button
          onClick={() => handleSwipe("left")}
          className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-700 hover:border-red-500/50 hover:bg-red-500/10 flex items-center justify-center text-red-400 transition-all active:scale-95 shadow-lg"
        >
          <X className="w-6 h-6" />
        </button>
        <a
          href={currentIssue?.html_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-700 hover:border-blue-500/50 hover:bg-blue-500/10 flex items-center justify-center text-blue-400 transition-all shadow-lg"
          title="Open issue"
        >
          <BookOpen className="w-5 h-5" />
        </a>
        <button
          onClick={() => handleSwipe("right")}
          className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-700 hover:border-emerald-500/50 hover:bg-emerald-500/10 flex items-center justify-center text-emerald-400 transition-all active:scale-95 shadow-lg"
        >
          <Check className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}