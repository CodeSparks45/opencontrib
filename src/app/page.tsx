"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  GitPullRequest, Zap, Brain, Trophy, Activity, 
  Shield, Github, ChevronRight, Sparkles 
} from "lucide-react";

export default function LandingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const handleCTA = () => {
    if (status === "authenticated") {
      router.push("/dashboard");
    } else {
      signIn("github", { callbackUrl: "/dashboard" });
    }
  };

  return (
    <div className="min-h-screen bg-[#040814] text-white selection:bg-cyan-500/30 overflow-hidden relative">
      
      {/* Background Glow Effects */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.4)]">
            <GitPullRequest className="w-4 h-4 text-white" />
          </div>
          OpenContrib
        </div>
        <div>
          {status === "authenticated" ? (
            <button 
              onClick={() => router.push("/dashboard")}
              className="px-5 py-2 rounded-full border border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-sm font-medium transition-colors"
            >
              Go to Dashboard
            </button>
          ) : (
            <button 
              onClick={() => signIn("github")}
              className="px-5 py-2 rounded-full border border-zinc-700 bg-zinc-900/50 hover:bg-zinc-800 text-sm font-medium transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-24 flex flex-col items-start animate-in fade-in slide-in-from-bottom-8 duration-1000">
        
        {/* Pill Badge */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-xs font-semibold mb-8 uppercase tracking-widest">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          Open Source Contribution Platform
        </div>

        {/* Massive Headline */}
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[1.1] mb-6">
          Find Issues. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 filter drop-shadow-[0_0_20px_rgba(34,211,238,0.3)]">
            Ship Code.
          </span> <br />
          Level Up.
        </h1>

        <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mb-10 leading-relaxed">
          The smartest way to discover open-source issues — from beginner to advanced. 
          AI-matched, gamified, and built for developers who ship.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <button 
            onClick={handleCTA}
            className="w-full sm:w-auto flex items-center justify-center gap-3 bg-cyan-500 hover:bg-cyan-400 text-black px-8 py-4 rounded-full font-bold text-lg transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(34,211,238,0.4)] active:scale-95"
          >
            {status === "loading" ? (
              <Sparkles className="w-5 h-5 animate-spin" />
            ) : (
              <Github className="w-5 h-5" />
            )}
            {status === "authenticated" ? "Enter Workspace" : "Continue with GitHub"}
            <ChevronRight className="w-5 h-5" />
          </button>
          
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors font-medium"
          >
            View on GitHub
          </a>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-16 mt-20 border-t border-zinc-800 pt-10 w-full">
          <div>
            <div className="text-3xl md:text-4xl font-black text-cyan-400 mb-1">10,000+</div>
            <div className="text-sm text-zinc-500 font-medium uppercase tracking-wider">Issues Tracked</div>
          </div>
          <div>
            <div className="text-3xl md:text-4xl font-black text-blue-400 mb-1">0</div>
            <div className="text-sm text-zinc-500 font-medium uppercase tracking-wider">Competition Mode</div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <div className="text-3xl md:text-4xl font-black text-emerald-400 mb-1">98%</div>
            <div className="text-sm text-zinc-500 font-medium uppercase tracking-wider">AI Match Accuracy</div>
          </div>
        </div>

        {/* Premium Features Grid (Bento Style) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full mt-24">
          
          <div className="bg-[#0a0f1c] border border-zinc-800/50 p-6 rounded-3xl hover:border-cyan-500/30 transition-colors group">
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Zap className="w-5 h-5 text-orange-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Swipe to Discover</h3>
            <p className="text-sm text-zinc-500">Tinder-style issue browsing. Save what interests you, skip what doesn't. Fast and addictive.</p>
          </div>

          <div className="bg-[#0a0f1c] border border-zinc-800/50 p-6 rounded-3xl hover:border-purple-500/30 transition-colors group">
            <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">AI Issue Matching</h3>
            <p className="text-sm text-zinc-500">Claude analyzes your tech stack and suggests perfectly matched open-source issues instantly.</p>
          </div>

          <div className="bg-[#0a0f1c] border border-zinc-800/50 p-6 rounded-3xl hover:border-yellow-500/30 transition-colors group">
            <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Trophy className="w-5 h-5 text-yellow-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Streak & XP System</h3>
            <p className="text-sm text-zinc-500">Earn XP for every contribution. Maintain streaks. Climb the leaderboard like a pro.</p>
          </div>

          <div className="bg-[#0a0f1c] border border-zinc-800/50 p-6 rounded-3xl hover:border-blue-500/30 transition-colors group">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <GitPullRequest className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">PR Tracker</h3>
            <p className="text-sm text-zinc-500">Track all your open PRs across every repo in one unified dashboard.</p>
          </div>

          <div className="bg-[#0a0f1c] border border-zinc-800/50 p-6 rounded-3xl hover:border-red-500/30 transition-colors group">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Activity className="w-5 h-5 text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Live Heatmap</h3>
            <p className="text-sm text-zinc-500">See which repos are most active right now. Spot opportunities before anyone else.</p>
          </div>

          <div className="bg-[#0a0f1c] border border-zinc-800/50 p-6 rounded-3xl hover:border-emerald-500/30 transition-colors group">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Difficulty Radar</h3>
            <p className="text-sm text-zinc-500">Every issue is auto-scored Beginner → Advanced based on codebase complexity.</p>
          </div>

        </div>
      </main>
    </div>
  );
}