"use client";

// ─── FIXES IN THIS FILE ────────────────────────────────────────────────────
// 1. signIn() wrapped in try/catch — no more silent crashes
// 2. Orb divs moved OUTSIDE canvas stacking context with explicit pointer-events:none
// 3. All CTA buttons have guaranteed pointer-events + z-index
// 4. Mobile canvas disabled via JS (not just CSS) to prevent "Aww Snap"
// 5. Redirect to /dashboard after successful auth
// ──────────────────────────────────────────────────────────────────────────

import { signIn, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

// Safely call signIn — catches any NextAuth configuration errors
async function handleSignIn(showToast: (m: string) => void) {
  try {
    await signIn("github", { callbackUrl: "/dashboard" });
  } catch (err: any) {
    console.error("SignIn error:", err);
    showToast("⚠️ Sign in failed. Check your GitHub OAuth config.");
  }
}

export default function LandingPage() {
  const { data: session, status } = useSession();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState("");
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(""), 4000);
  };

  // ── Particle canvas (desktop only, safe) ──────────────────────────────────
  useEffect(() => {
    setMounted(true);
    // Skip canvas on mobile to prevent memory crashes
    if (typeof window === "undefined" || window.innerWidth < 768) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = (canvas.width = window.innerWidth);
    let H = (canvas.height = window.innerHeight);

    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number };
    const pts: P[] = Array.from({ length: 55 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.22, vy: (Math.random() - 0.5) * 0.22,
      r: Math.random() * 1.3 + 0.3, a: Math.random() * 0.4 + 0.07,
    }));

    let raf: number;
    const tick = () => {
      ctx.clearRect(0, 0, W, H);
      pts.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,229,255,${p.a})`; ctx.fill();
        pts.slice(i + 1).forEach(q => {
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < 130) {
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(0,229,255,${0.045 * (1 - d / 130)})`;
            ctx.lineWidth = 0.5; ctx.stroke();
          }
        });
      });
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);

  // ── Animated counters ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    const ease = (t: number) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    document.querySelectorAll<HTMLElement>("[data-target]").forEach(el => {
      const target = parseInt(el.dataset.target!);
      const suffix = el.dataset.suffix || "";
      const dur = 1800; const start = performance.now();
      const upd = (now: number) => {
        const p = Math.min((now - start) / dur, 1);
        el.textContent = Math.floor(ease(p) * target).toLocaleString() + suffix;
        if (p < 1) requestAnimationFrame(upd);
      };
      requestAnimationFrame(upd);
    });
  }, [mounted]);

  // ── Scroll reveal ─────────────────────────────────────────────────────────
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach(e => e.isIntersecting && e.target.classList.add("lp-vis")),
      { threshold: 0.06, rootMargin: "0px 0px -20px 0px" }
    );
    document.querySelectorAll(".lp-rv").forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // ── Issue highlight cycle ─────────────────────────────────────────────────
  useEffect(() => {
    let idx = 0;
    const issues = document.querySelectorAll<HTMLElement>(".lp-iss");
    if (!issues.length) return;
    issues[0].classList.add("lp-on");
    const t = setInterval(() => {
      issues.forEach(el => el.classList.remove("lp-on"));
      idx = (idx + 1) % issues.length;
      issues[idx].classList.add("lp-on");
    }, 2800);
    return () => clearInterval(t);
  }, []);

  // ── Live activity feed ────────────────────────────────────────────────────
  useEffect(() => {
    const FEED = [
      { ini: "AK", color: "#00E5FF", user: "alok_kr", repo: "facebook/react", txt: "Fixed race condition in hooks", xp: "+150 XP" },
      { ini: "RV", color: "#7C3AED", user: "rv_codes", repo: "microsoft/TypeScript", txt: "Improved generic inference", xp: "+300 XP" },
      { ini: "SG", color: "#00FFA3", user: "saksh_g", repo: "python/cpython", txt: "Added type hints to pathlib", xp: "+80 XP" },
      { ini: "NK", color: "#fb923c", user: "nikhil99", repo: "rust-lang/rust", txt: "Fix lifetime error messages", xp: "+200 XP" },
      { ini: "PR", color: "#f43f5e", user: "priya_r", repo: "vercel/next.js", txt: "Fixed ISR cache invalidation", xp: "+180 XP" },
    ];
    let i = 0;
    const list = document.getElementById("lp-actlist");
    if (!list) return;
    const t = setInterval(() => {
      const a = FEED[i % FEED.length]; i++;
      const el = document.createElement("div");
      el.className = "lp-act-item";
      el.style.cssText = "opacity:0;transform:translateY(-8px);transition:all 0.45s cubic-bezier(.16,1,.3,1);";
      el.innerHTML = `<div class="lp-act-av" style="background:${a.color}">${a.ini}</div><div class="lp-act-body"><span class="lp-act-user">@${a.user}</span> merged PR in <span class="lp-act-repo">${a.repo}</span> — ${a.txt} <span class="lp-act-xp">${a.xp}</span></div><div class="lp-act-time">just now</div>`;
      list.insertBefore(el, list.firstChild);
      requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "translateY(0)"; }));
      while (list.children.length > 3) {
        const last = list.lastChild as HTMLElement;
        if (last) { last.style.opacity = "0"; setTimeout(() => last.remove(), 350); }
      }
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const isAuthed = status === "authenticated";

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700;12..96,800&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=Fira+Code:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        :root{
          --bg:#050810;--bg1:#080d1a;--bg2:#0c1220;
          --cyan:#00E5FF;--cdim:rgba(0,229,255,.1);
          --purple:#7C3AED;--green:#00FFA3;--orange:#FF6B35;--pink:#FF2D78;
          --t1:#F0F4FF;--t2:rgba(240,244,255,.55);--t3:rgba(240,244,255,.22);
          --bd:rgba(255,255,255,.07);--bdh:rgba(0,229,255,.22);
          --fd:'Bricolage Grotesque',system-ui,sans-serif;
          --fb:'Plus Jakarta Sans',system-ui,sans-serif;
          --fm:'Fira Code',monospace;
        }
        html{scroll-behavior:smooth;}
        body{background:var(--bg);color:var(--t1);font-family:var(--fb);font-size:15px;line-height:1.65;-webkit-font-smoothing:antialiased;overflow-x:hidden;}

        /* ── BACKGROUND LAYERS — all pointer-events:none to never eat clicks ── */
        .lp-canvas{position:fixed;inset:0;pointer-events:none !important;z-index:0;opacity:.5;}
        .lp-grid{position:fixed;inset:0;background-image:linear-gradient(rgba(0,229,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,.022) 1px,transparent 1px);background-size:56px 56px;pointer-events:none !important;z-index:0;}
        /* Orbs: z-index 0, pointer-events:none — sit BELOW everything interactive */
        .lp-orb{position:fixed;border-radius:50%;pointer-events:none !important;z-index:0;}
        .lp-o1{width:680px;height:680px;background:radial-gradient(circle,rgba(0,229,255,.065) 0%,transparent 70%);top:-15%;left:-10%;animation:lp-drift1 18s ease-in-out infinite;}
        .lp-o2{width:580px;height:580px;background:radial-gradient(circle,rgba(124,58,237,.085) 0%,transparent 70%);top:25%;right:-8%;animation:lp-drift2 22s ease-in-out infinite;}
        .lp-o3{width:430px;height:430px;background:radial-gradient(circle,rgba(0,255,163,.055) 0%,transparent 70%);bottom:5%;left:20%;animation:lp-drift3 16s ease-in-out infinite;}
        @keyframes lp-drift1{0%,100%{transform:translate(0,0)}33%{transform:translate(48px,-32px)}66%{transform:translate(-22px,52px)}}
        @keyframes lp-drift2{0%,100%{transform:translate(0,0)}33%{transform:translate(-58px,42px)}66%{transform:translate(32px,-22px)}}
        @keyframes lp-drift3{0%,100%{transform:translate(0,0)}50%{transform:translate(-38px,-32px)}}

        /* ── NAV — z-index:200 so it always sits above everything ── */
        .lp-nav{position:sticky;top:0;z-index:200;backdrop-filter:blur(24px);background:rgba(5,8,16,.78);border-bottom:1px solid rgba(255,255,255,.05);}
        .lp-nav-inner{display:flex;align-items:center;justify-content:space-between;padding:14px 32px;max-width:1120px;margin:0 auto;}
        .lp-logo{display:flex;align-items:center;gap:10px;font-family:var(--fd);font-weight:700;font-size:17px;color:var(--t1);text-decoration:none;cursor:pointer;}
        .lp-logo-ico{width:32px;height:32px;border-radius:9px;background:linear-gradient(135deg,var(--cdim),rgba(124,58,237,.18));border:1px solid rgba(0,229,255,.25);display:flex;align-items:center;justify-content:center;}
        .lp-nav-links{display:flex;gap:28px;list-style:none;}
        .lp-nav-links a{color:var(--t2);text-decoration:none;font-size:13.5px;font-weight:500;transition:color .2s;cursor:pointer;}
        .lp-nav-links a:hover{color:var(--t1);}
        .lp-nav-r{display:flex;gap:10px;align-items:center;}

        /* ── BUTTONS — highest z-index, always clickable ── */
        .lp-btn{
          position:relative;
          z-index:500;          /* well above orbs (z:0) and grid (z:0) */
          pointer-events:auto !important;
          display:inline-flex;align-items:center;gap:7px;
          padding:10px 22px;border-radius:12px;
          font-family:var(--fd);font-weight:700;font-size:13.5px;
          cursor:pointer;border:none;
          transition:all .25s cubic-bezier(.16,1,.3,1);
          overflow:hidden;text-decoration:none;white-space:nowrap;
        }
        .lp-btn-p{background:linear-gradient(135deg,#00C8EC,#0077FF);color:#000;}
        .lp-btn-p::after{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.22),transparent);opacity:0;transition:opacity .2s;}
        .lp-btn-p:hover::after{opacity:1;}
        .lp-btn-p:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,160,255,.4);}
        .lp-btn-p:active{transform:scale(.97);}
        .lp-btn-g{background:transparent;color:var(--t2);border:1px solid var(--bd);}
        .lp-btn-g:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.14);color:var(--t1);transform:translateY(-1px);}
        .lp-btn-lg{padding:15px 32px;font-size:15px;border-radius:14px;}
        .lp-btn-xl{padding:17px 38px;font-size:16px;border-radius:16px;}

        /* ── HERO — z-index:10 so content floats above background layers ── */
        .lp-hero{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center;padding:68px 32px 80px;max-width:1120px;margin:0 auto;position:relative;z-index:10;}
        /* The left side content needs its own stacking context above the orbs */
        .lp-left{position:relative;z-index:10;}

        @media(max-width:768px){
          .lp-hero{grid-template-columns:1fr;gap:40px;}
          .lp-nav-links{display:none;}
          .lp-vis-wrap{display:none;}
          .lp-canvas{display:none !important;}
          .lp-grid{opacity:.25;}
        }

        .lp-badge{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border-radius:99px;background:rgba(0,229,255,.06);border:1px solid rgba(0,229,255,.2);margin-bottom:28px;font-size:11.5px;font-weight:700;color:var(--cyan);letter-spacing:.07em;text-transform:uppercase;opacity:0;animation:lp-fadeUp .6s .05s forwards;}
        .lp-pdot{width:6px;height:6px;border-radius:50%;background:#4ade80;box-shadow:0 0 10px #4ade80;animation:lp-glow-dot 2s ease infinite;}
        @keyframes lp-glow-dot{0%,100%{box-shadow:0 0 5px #4ade80}50%{box-shadow:0 0 16px #4ade80,0 0 32px rgba(74,222,128,.35)}}
        @keyframes lp-fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        .lp-h1{font-family:var(--fd);font-size:clamp(40px,5.2vw,68px);font-weight:800;line-height:1.03;letter-spacing:-.035em;margin-bottom:22px;}
        .lp-hl{display:block;overflow:hidden;}
        .lp-hw{display:inline-block;transform:translateY(110%);opacity:0;animation:lp-wup .75s cubic-bezier(.16,1,.3,1) forwards;}
        @keyframes lp-wup{to{transform:translateY(0);opacity:1}}
        .lp-gtext{background:linear-gradient(135deg,var(--cyan) 0%,var(--green) 50%,var(--purple) 100%);background-size:200%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:lp-gs 5s ease infinite;}
        @keyframes lp-gs{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        .lp-dim{color:var(--t3);}
        .lp-sub{color:var(--t2);font-size:16px;line-height:1.78;max-width:480px;margin-bottom:34px;opacity:0;animation:lp-fadeUp .6s .5s forwards;}
        .lp-acts{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:48px;opacity:0;animation:lp-fadeUp .6s .65s forwards;position:relative;z-index:10;}
        .lp-stats{display:flex;gap:36px;align-items:center;opacity:0;animation:lp-fadeUp .6s .8s forwards;}
        .lp-sn{font-family:var(--fd);font-size:28px;font-weight:800;color:var(--cyan);line-height:1;letter-spacing:-.03em;}
        .lp-sl{font-size:11px;color:var(--t3);font-weight:500;margin-top:3px;text-transform:uppercase;letter-spacing:.04em;}
        .lp-sdiv{width:1px;height:32px;background:var(--bd);}

        /* ── TERMINAL WIDGET ── */
        .lp-vis-wrap{position:relative;opacity:0;animation:lp-fadeUp 1s .3s forwards;z-index:5;}
        .lp-float{position:absolute;backdrop-filter:blur(20px);background:rgba(8,13,26,.92);border:1px solid var(--bd);border-radius:12px;padding:10px 16px;box-shadow:0 8px 32px rgba(0,0,0,.5);z-index:6;}
        .lp-fl1{top:-18px;right:-18px;animation:lp-flt 4s ease-in-out infinite;}
        .lp-fl2{bottom:22px;left:-28px;animation:lp-flt 4.5s 2s ease-in-out infinite;}
        @keyframes lp-flt{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
        .lp-xpf{display:flex;align-items:center;gap:8px;font-family:var(--fd);font-weight:800;font-size:14px;color:#fbbf24;}
        .lp-strf{font-size:13px;color:var(--t2);}
        .lp-strf strong{color:#fb923c;font-family:var(--fd);font-size:17px;}
        .lp-term{background:var(--bg2);border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.6),0 0 80px rgba(0,229,255,.05);position:relative;}
        .lp-term::before{content:'';position:absolute;inset:0;border-radius:20px;padding:1px;background:linear-gradient(135deg,rgba(0,229,255,.28),transparent 50%,rgba(124,58,237,.28));-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;z-index:2;}
        .lp-thead{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid var(--bd);background:rgba(255,255,255,.02);}
        .lp-dots{display:flex;gap:6px;}
        .lp-d{width:10px;height:10px;border-radius:50%;}
        .lp-d:nth-child(1){background:#FF5F57}.lp-d:nth-child(2){background:#FEBC2E}.lp-d:nth-child(3){background:#28C840}
        .lp-ttitle{flex:1;text-align:center;font-size:11.5px;color:var(--t3);font-family:var(--fm);}
        .lp-live{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;color:#4ade80;letter-spacing:.05em;}
        .lp-ldot{width:5px;height:5px;border-radius:50%;background:#4ade80;animation:lp-glow-dot 2s ease infinite;}
        .lp-tbody{padding:16px;}
        .lp-iss{display:flex;align-items:flex-start;gap:12px;padding:12px;border-radius:12px;border:1px solid transparent;margin-bottom:8px;background:rgba(255,255,255,.02);cursor:pointer;transition:all .3s;}
        .lp-iss:hover,.lp-iss.lp-on{border-color:rgba(0,229,255,.18);background:rgba(0,229,255,.04);}
        .lp-iico{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;}
        .lp-iico.r{background:rgba(97,218,251,.12)}.lp-iico.u{background:rgba(255,107,53,.12)}.lp-iico.p{background:rgba(55,176,92,.12)}
        .lp-iinfo{flex:1;min-width:0;}
        .lp-irepo{font-size:10.5px;color:var(--t3);font-family:var(--fm);margin-bottom:3px;}
        .lp-ititle{font-size:12.5px;font-weight:600;color:var(--t1);line-height:1.4;margin-bottom:6px;}
        .lp-itags{display:flex;gap:5px;flex-wrap:wrap;}
        .lp-tag{font-size:10px;font-weight:700;padding:2px 8px;border-radius:99px;}
        .lp-tg{color:var(--green);background:rgba(0,255,163,.1)}.lp-tc{color:var(--cyan);background:var(--cdim)}.lp-to{color:var(--orange);background:rgba(255,107,53,.1)}
        .lp-imeta{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0;}
        .lp-iscore{font-family:var(--fd);font-size:18px;font-weight:800;color:var(--cyan);}
        .lp-imatch{font-size:10px;color:var(--t3);}
        .lp-swrow{display:flex;gap:10px;justify-content:center;padding:12px 0 2px;}
        .lp-sbtn{width:42px;height:42px;border-radius:50%;border:1px solid var(--bd);background:transparent;display:flex;align-items:center;justify-content:center;font-size:17px;cursor:pointer;transition:all .2s;}
        .lp-sbtn.s:hover{background:rgba(248,113,113,.12);border-color:rgba(248,113,113,.3);}
        .lp-sbtn.a:hover{background:rgba(167,139,250,.12);border-color:rgba(167,139,250,.3);}
        .lp-sbtn.v:hover{background:rgba(0,255,163,.12);border-color:rgba(0,255,163,.3);}

        /* ── MARQUEE ── */
        .lp-marquee{padding:30px 0;border-top:1px solid var(--bd);border-bottom:1px solid var(--bd);overflow:hidden;position:relative;z-index:10;mask-image:linear-gradient(90deg,transparent,black 12%,black 88%,transparent);}
        .lp-mtrack{display:flex;gap:48px;animation:lp-mq 30s linear infinite;width:max-content;}
        @keyframes lp-mq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        .lp-mitem{display:flex;align-items:center;gap:8px;color:var(--t3);font-size:13px;font-weight:600;white-space:nowrap;font-family:var(--fm);}
        .lp-mdot{width:3px;height:3px;border-radius:50%;background:var(--t3);}

        /* ── SECTIONS ── */
        .lp-sec{padding:88px 32px;max-width:1120px;margin:0 auto;position:relative;z-index:10;}
        .lp-stag{display:inline-flex;align-items:center;gap:8px;font-size:11.5px;font-weight:700;color:var(--cyan);letter-spacing:.09em;text-transform:uppercase;margin-bottom:14px;}
        .lp-stag::before{content:'';width:20px;height:1px;background:var(--cyan);}
        .lp-stitle{font-family:var(--fd);font-size:clamp(30px,4vw,48px);font-weight:800;letter-spacing:-.03em;line-height:1.06;margin-bottom:52px;}

        /* ── BENTO ── */
        .lp-bento{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;}
        @media(max-width:768px){.lp-bento{grid-template-columns:1fr;}}
        .lp-bc{background:var(--bg1);border:1px solid var(--bd);border-radius:22px;padding:26px;overflow:hidden;position:relative;transition:transform .35s cubic-bezier(.16,1,.3,1),border-color .3s,box-shadow .3s;will-change:transform;}
        .lp-bc::after{content:'';position:absolute;inset:0;border-radius:22px;background:linear-gradient(135deg,rgba(255,255,255,.03) 0%,transparent 55%);pointer-events:none;}
        .lp-bc:hover{border-color:rgba(0,229,255,.15);box-shadow:0 18px 50px rgba(0,0,0,.45),0 0 0 1px rgba(0,229,255,.07);transform:translateY(-3px);}
        .lp-b-wide{grid-column:span 2;}
        @media(max-width:768px){.lp-b-wide{grid-column:span 1;}}
        .lp-ctag{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px;}
        .lp-ctitle{font-family:var(--fd);font-size:20px;font-weight:700;letter-spacing:-.02em;margin-bottom:7px;line-height:1.25;}
        .lp-cdesc{font-size:13px;color:var(--t2);line-height:1.65;max-width:320px;}
        .lp-drow{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
        .lp-dlbl{font-size:11.5px;font-weight:600;color:var(--t2);width:88px;}
        .lp-dbarw{flex:1;height:5px;background:rgba(255,255,255,.05);border-radius:99px;overflow:hidden;}
        .lp-dbar{height:100%;border-radius:99px;width:0;transition:width 1.6s cubic-bezier(.16,1,.3,1);}
        .lp-db{background:linear-gradient(90deg,var(--green),var(--cyan));}
        .lp-di{background:linear-gradient(90deg,#fbbf24,#fb923c);}
        .lp-da{background:linear-gradient(90deg,#f87171,var(--pink));}
        .lp-dcnt{font-size:11px;color:var(--t3);font-family:var(--fm);width:30px;text-align:right;}
        .lp-act-list{display:flex;flex-direction:column;gap:8px;margin-top:14px;}
        #lp-actlist{min-height:80px;}
        .lp-act-item{display:flex;align-items:center;gap:10px;padding:9px 12px;background:rgba(255,255,255,.025);border-radius:9px;border:1px solid var(--bd);}
        .lp-act-av{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#000;flex-shrink:0;}
        .lp-act-body{font-size:11.5px;color:var(--t2);flex:1;line-height:1.4;}
        .lp-act-user{color:var(--t1);font-weight:600;}
        .lp-act-repo{color:var(--cyan);}
        .lp-act-xp{color:#fbbf24;font-weight:600;}
        .lp-act-time{font-size:10px;color:var(--t3);font-family:var(--fm);flex-shrink:0;}

        /* ── STEPS ── */
        .lp-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;position:relative;}
        @media(max-width:768px){.lp-steps{grid-template-columns:1fr;}}
        .lp-steps::before{content:'';position:absolute;top:38px;left:16%;right:16%;height:1px;background:linear-gradient(90deg,transparent,rgba(0,229,255,.2),transparent);}
        .lp-step{background:var(--bg1);border:1px solid var(--bd);border-radius:22px;padding:28px;position:relative;overflow:hidden;transition:all .3s;}
        .lp-step:hover{border-color:rgba(0,229,255,.2);transform:translateY(-4px);box-shadow:0 20px 50px rgba(0,0,0,.4);}
        .lp-step-n{font-family:var(--fd);font-size:70px;font-weight:800;color:rgba(0,229,255,.04);line-height:1;position:absolute;top:10px;right:14px;pointer-events:none;}
        .lp-step-ico{width:48px;height:48px;border-radius:12px;background:var(--cdim);border:1px solid rgba(0,229,255,.2);display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:18px;}
        .lp-step-t{font-family:var(--fd);font-size:18px;font-weight:700;letter-spacing:-.02em;margin-bottom:9px;}
        .lp-step-d{font-size:13px;color:var(--t2);line-height:1.65;}

        /* ── TESTIMONIALS ── */
        .lp-tcards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}
        @media(max-width:768px){.lp-tcards{grid-template-columns:1fr;}}
        .lp-tcard{background:var(--bg1);border:1px solid var(--bd);border-radius:22px;padding:26px;transition:all .3s;}
        .lp-tcard:hover{border-color:rgba(0,229,255,.14);transform:translateY(-3px);}
        .lp-stars{display:flex;gap:3px;margin-bottom:12px;}
        .lp-star{color:#fbbf24;font-size:12.5px;}
        .lp-tq{font-size:26px;color:var(--cyan);font-family:var(--fd);line-height:1;margin-bottom:10px;}
        .lp-ttxt{font-size:13px;color:var(--t2);line-height:1.7;margin-bottom:18px;font-style:italic;}
        .lp-tauth{display:flex;align-items:center;gap:10px;}
        .lp-tav{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#000;}
        .lp-tname{font-size:13px;font-weight:600;color:var(--t1);}
        .lp-trole{font-size:11.5px;color:var(--t3);}

        /* ── CTA ── */
        .lp-cta-wrap{padding:60px 32px 100px;max-width:960px;margin:0 auto;position:relative;z-index:10;text-align:center;}
        .lp-cta-card{background:linear-gradient(135deg,rgba(0,229,255,.06),rgba(124,58,237,.06));border:1px solid rgba(0,229,255,.15);border-radius:36px;padding:72px 52px;position:relative;overflow:hidden;}
        .lp-cta-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,var(--cyan),transparent);}
        .lp-cta-glow{position:absolute;width:500px;height:400px;border-radius:50%;background:radial-gradient(ellipse,rgba(0,229,255,.07) 0%,transparent 70%);top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none !important;}
        .lp-cta-t{font-family:var(--fd);font-size:clamp(32px,5vw,54px);font-weight:800;letter-spacing:-.03em;line-height:1.06;margin-bottom:14px;position:relative;}
        .lp-cta-s{font-size:15px;color:var(--t2);margin-bottom:32px;max-width:420px;margin-left:auto;margin-right:auto;position:relative;}
        .lp-cta-acts{display:flex;align-items:center;justify-content:center;gap:12px;position:relative;z-index:100;flex-wrap:wrap;}

        /* ── FOOTER ── */
        .lp-footer{border-top:1px solid var(--bd);padding:28px 32px;display:flex;align-items:center;justify-content:space-between;max-width:1120px;margin:0 auto;position:relative;z-index:10;flex-wrap:wrap;gap:12px;}
        .lp-fcopy{font-size:12.5px;color:var(--t3);}
        .lp-flinks{display:flex;gap:22px;}
        .lp-flinks a{font-size:12.5px;color:var(--t3);text-decoration:none;transition:color .2s;cursor:pointer;}
        .lp-flinks a:hover{color:var(--t2);}

        /* ── SCROLL REVEAL ── */
        .lp-rv{opacity:0;transform:translateY(26px);transition:opacity .7s ease,transform .7s cubic-bezier(.16,1,.3,1);}
        .lp-rv.lp-vis{opacity:1;transform:translateY(0);}
        .lp-d1{transition-delay:.1s}.lp-d2{transition-delay:.2s}.lp-d3{transition-delay:.3s}

        /* ── TOAST ── */
        .lp-toast{position:fixed;bottom:28px;right:28px;z-index:9999;background:var(--bg2);border:1px solid rgba(0,229,255,.25);border-radius:14px;padding:12px 18px;font-size:13px;font-weight:600;color:var(--t1);box-shadow:0 10px 40px rgba(0,0,0,.5);animation:lp-fadeUp .35s ease;max-width:320px;}
      `}} />

      {/* ── BACKGROUND (all pointer-events:none, z-index:0) ── */}
      <canvas ref={canvasRef} className="lp-canvas" />
      <div className="lp-grid" />
      <div className="lp-orb lp-o1" />
      <div className="lp-orb lp-o2" />
      <div className="lp-orb lp-o3" />

      {/* ── TOAST ── */}
      {toast && <div className="lp-toast">{toast}</div>}

      {/* ── NAV ── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <a className="lp-logo" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            <div className="lp-logo-ico">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
            </div>
            OpenContrib
          </a>
          <ul className="lp-nav-links">
            <li><a onClick={() => document.getElementById("lp-features")?.scrollIntoView({ behavior: "smooth" })}>Features</a></li>
            <li><a onClick={() => document.getElementById("lp-howto")?.scrollIntoView({ behavior: "smooth" })}>How it works</a></li>
            <li><a onClick={() => document.getElementById("lp-reviews")?.scrollIntoView({ behavior: "smooth" })}>Reviews</a></li>
          </ul>
          <div className="lp-nav-r">
            {isAuthed ? (
              <a href="/dashboard" className="lp-btn lp-btn-p" style={{ padding: "9px 20px", fontSize: "13px" }}>
                Dashboard ✦
              </a>
            ) : (
              <button onClick={() => handleSignIn(showToast)} className="lp-btn lp-btn-p" style={{ padding: "9px 20px", fontSize: "13px" }}>
                Sign in with GitHub
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="lp-hero">
        <div className="lp-left">
          <div className="lp-badge"><div className="lp-pdot" />Open Source Contribution Platform</div>
          <h1 className="lp-h1">
            <span className="lp-hl"><span className="lp-hw" style={{ animationDelay: ".05s" }}>Find Issues.</span></span>
            <span className="lp-hl"><span className="lp-hw lp-gtext" style={{ animationDelay: ".18s" }}>Ship Code.</span></span>
            <span className="lp-hl lp-dim"><span className="lp-hw" style={{ animationDelay: ".3s" }}>Level Up.</span></span>
          </h1>
          <p className="lp-sub">The smartest way to discover open-source issues — AI-matched to your stack, gamified for momentum, and built for developers who actually ship.</p>
          <div className="lp-acts">
            {isAuthed ? (
              <a href="/dashboard" className="lp-btn lp-btn-p lp-btn-xl">Open Dashboard →</a>
            ) : (
              <button onClick={() => handleSignIn(showToast)} className="lp-btn lp-btn-p lp-btn-xl">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
                Continue with GitHub 🚀
              </button>
            )}
            <button className="lp-btn lp-btn-g lp-btn-xl" onClick={() => document.getElementById("lp-features")?.scrollIntoView({ behavior: "smooth" })}>See Features ↓</button>
          </div>
          <div className="lp-stats">
            <div><div className="lp-sn" data-target="12400" data-suffix="+">{mounted ? "0" : "12,400+"}</div><div className="lp-sl">Issues Tracked</div></div>
            <div className="lp-sdiv" />
            <div><div className="lp-sn" data-target="3200" data-suffix="+">{mounted ? "0" : "3,200+"}</div><div className="lp-sl">Contributors</div></div>
            <div className="lp-sdiv" />
            <div><div className="lp-sn" data-target="98" data-suffix="%">{mounted ? "0" : "98%"}</div><div className="lp-sl">Match Accuracy</div></div>
          </div>
        </div>

        {/* Terminal widget */}
        <div className="lp-vis-wrap">
          <div className="lp-float lp-fl1"><div className="lp-xpf">⚡ +250 XP Earned!</div></div>
          <div className="lp-float lp-fl2"><div className="lp-strf">🔥 <strong>14</strong> day streak!</div></div>
          <div className="lp-term">
            <div className="lp-thead">
              <div className="lp-dots"><div className="lp-d"/><div className="lp-d"/><div className="lp-d"/></div>
              <div className="lp-ttitle">opencontrib ~ live-issues</div>
              <div className="lp-live"><div className="lp-ldot"/>LIVE</div>
            </div>
            <div className="lp-tbody">
              {[
                { cls:"r", icon:"⚛️", repo:"facebook/react", title:"Fix hydration mismatch in async Suspense", tags:["good first issue","react"], score:"94%" },
                { cls:"u", icon:"🦀", repo:"rust-lang/rust", title:"Improve lifetime error messages in compiler", tags:["intermediate","compiler"], score:"87%" },
                { cls:"p", icon:"🐍", repo:"python/cpython", title:"Add type hints to pathlib.Path methods", tags:["beginner","types"], score:"81%" },
              ].map((iss, i) => (
                <div key={i} className={`lp-iss${i===0?" lp-on":""}`}>
                  <div className={`lp-iico ${iss.cls}`}>{iss.icon}</div>
                  <div className="lp-iinfo">
                    <div className="lp-irepo">{iss.repo}</div>
                    <div className="lp-ititle">{iss.title}</div>
                    <div className="lp-itags">
                      {iss.tags.map(t => <span key={t} className={`lp-tag ${t.includes("first")||t==="beginner"?"lp-tg":t==="intermediate"?"lp-to":"lp-tc"}`}>{t}</span>)}
                    </div>
                  </div>
                  <div className="lp-imeta"><div className="lp-iscore">{iss.score}</div><div className="lp-imatch">match</div></div>
                </div>
              ))}
              <div className="lp-swrow">
                <button className="lp-sbtn s">✕</button>
                <button className="lp-sbtn a">✦</button>
                <button className="lp-sbtn v" onClick={() => handleSignIn(showToast)}>♥</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MARQUEE ── */}
      <div className="lp-marquee">
        <div className="lp-mtrack">
          {["React","Rust","Python","TypeScript","Go","Kubernetes","Next.js","Svelte","WebAssembly","PostgreSQL","Redis","Vue","Docker","GraphQL"].flatMap(t => [
            <div key={t} className="lp-mitem"><span>{t}</span><div className="lp-mdot"/></div>,
            <div key={t+"2"} className="lp-mitem"><span>{t}</span><div className="lp-mdot"/></div>,
          ])}
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section className="lp-sec" id="lp-features">
        <div className="lp-rv"><div className="lp-stag">Features</div><h2 className="lp-stitle">Everything you need to become<br /><span className="lp-gtext">a top contributor</span></h2></div>
        <div className="lp-bento lp-rv lp-d1">
          <div className="lp-bc lp-b-wide" style={{ background:"linear-gradient(145deg,rgba(0,229,255,.04),var(--bg1))" }}>
            <div className="lp-ctag" style={{ color:"#a78bfa" }}>✦ AI-Powered</div>
            <div className="lp-ctitle">Intelligent Issue Matching</div>
            <div className="lp-cdesc">Claude AI analyzes your GitHub history, tech stack, and expertise to surface the perfect issues every single time.</div>
            <div style={{ marginTop:"18px" }}>
              <div className="lp-drow"><div className="lp-dlbl">Beginner</div><div className="lp-dbarw"><div className="lp-dbar lp-db" style={{ width:"72%" }}/></div><div className="lp-dcnt">72%</div></div>
              <div className="lp-drow"><div className="lp-dlbl">Intermediate</div><div className="lp-dbarw"><div className="lp-dbar lp-di" style={{ width:"55%" }}/></div><div className="lp-dcnt">55%</div></div>
              <div className="lp-drow"><div className="lp-dlbl">Advanced</div><div className="lp-dbarw"><div className="lp-dbar lp-da" style={{ width:"28%" }}/></div><div className="lp-dcnt">28%</div></div>
            </div>
          </div>
          <div className="lp-bc" style={{ background:"linear-gradient(145deg,rgba(251,146,60,.04),var(--bg1))" }}>
            <div className="lp-ctag" style={{ color:"#fb923c" }}>🔥 Streak System</div>
            <div className="lp-ctitle">Build Your Streak</div>
            <div className="lp-cdesc">Miss a day and your streak resets. The pressure keeps you consistent.</div>
            <div style={{ marginTop:"16px",fontFamily:"var(--fd)",fontSize:"52px",fontWeight:800,color:"#fb923c",lineHeight:1 }}>14</div>
            <div style={{ fontSize:"11px",color:"var(--t3)",marginTop:"4px" }}>DAY STREAK</div>
            <div style={{ height:"4px",background:"rgba(255,255,255,.06)",borderRadius:"99px",overflow:"hidden",marginTop:"12px" }}>
              <div style={{ height:"100%",width:"73%",background:"linear-gradient(90deg,#fb923c,#f59e0b)",borderRadius:"99px" }} />
            </div>
          </div>
          <div className="lp-bc" style={{ background:"linear-gradient(145deg,rgba(0,255,163,.035),var(--bg1))" }}>
            <div className="lp-ctag" style={{ color:"#4ade80" }}>● Live Feed</div>
            <div className="lp-ctitle">Global Activity</div>
            <div className="lp-cdesc">Watch contributors merge PRs in real-time. Let the momentum carry you.</div>
            <div className="lp-act-list"><div id="lp-actlist" /></div>
          </div>
          <div className="lp-bc" style={{ background:"linear-gradient(145deg,rgba(251,191,36,.04),var(--bg1))" }}>
            <div className="lp-ctag" style={{ color:"#fbbf24" }}>⚡ XP & Levels</div>
            <div className="lp-ctitle">Level Up Fast</div>
            <div className="lp-cdesc">Earn XP for every merged PR. Climb the leaderboard.</div>
            <div style={{ marginTop:"14px",fontFamily:"var(--fm)",fontSize:"11px",fontWeight:700,color:"var(--t3)",marginBottom:"6px" }}>LEVEL 12 → 13</div>
            <div style={{ height:"4px",background:"rgba(255,255,255,.06)",borderRadius:"99px",overflow:"hidden" }}>
              <div style={{ height:"100%",width:"65%",background:"linear-gradient(90deg,#fbbf24,#f59e0b)",borderRadius:"99px" }} />
            </div>
            <div style={{ fontSize:"11px",color:"var(--t3)",marginTop:"6px" }}>650 / 1000 XP</div>
          </div>
          <div className="lp-bc" style={{ background:"linear-gradient(145deg,rgba(255,45,120,.04),var(--bg1))" }}>
            <div className="lp-ctag" style={{ color:"#f43f5e" }}>← → Swipe Mode</div>
            <div className="lp-ctitle">Addictive Discovery</div>
            <div className="lp-cdesc">Tinder-style issue swiping. Save what interests you, skip what doesn't.</div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="lp-sec" id="lp-howto" style={{ paddingTop:"0" }}>
        <div className="lp-rv"><div className="lp-stag">How it works</div><h2 className="lp-stitle">Start contributing in<br /><span className="lp-gtext">3 simple steps</span></h2></div>
        <div className="lp-steps lp-rv lp-d1">
          {[
            { n:"01", ico:"🔑", t:"Connect GitHub", d:"Sign in with your GitHub account. We read your repos and tech stack to understand your skills. Zero setup required." },
            { n:"02", ico:"🤖", t:"Get AI Matches", d:"Claude analyzes thousands of open issues and picks the ones that are perfect for your level, stack, and interests." },
            { n:"03", ico:"🚀", t:"Ship & Level Up", d:"Open the issue, make your contribution, merge your PR. Earn XP, maintain your streak, climb the leaderboard." },
          ].map(s => (
            <div key={s.n} className="lp-step">
              <div className="lp-step-n">{s.n}</div>
              <div className="lp-step-ico">{s.ico}</div>
              <div className="lp-step-t">{s.t}</div>
              <div className="lp-step-d">{s.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="lp-sec" id="lp-reviews" style={{ paddingTop:"0" }}>
        <div className="lp-rv"><div className="lp-stag">Reviews</div><h2 className="lp-stitle">Loved by developers<br /><span className="lp-gtext">worldwide</span></h2></div>
        <div className="lp-tcards lp-rv lp-d1">
          {[
            { av:"AK", color:"#00E5FF", txt:"Found my first open-source contribution within 10 minutes. The AI matching is scary accurate — it knew exactly what I could handle.", name:"Alok Kumar", role:"Final year CSE, NIT Surat" },
            { av:"RV", color:"#7C3AED", txt:"The streak system got me contributing daily for 3 weeks straight. 11 PRs merged. My GitHub looks amazing now.", name:"Riya Verma", role:"Frontend Dev, Bangalore" },
            { av:"SG", color:"#00FFA3", txt:"Swipe mode is addictive. 50 issues in 15 minutes, saved 8 that matched my React skills perfectly. Nothing else comes close.", name:"Sahil Gupta", role:"GSSoC 2024 Contributor" },
          ].map(t => (
            <div key={t.name} className="lp-tcard">
              <div className="lp-stars">{[...Array(5)].map((_,i)=><span key={i} className="lp-star">★</span>)}</div>
              <div className="lp-tq">"</div>
              <div className="lp-ttxt">{t.txt}</div>
              <div className="lp-tauth">
                <div className="lp-tav" style={{ background:t.color }}>{t.av}</div>
                <div><div className="lp-tname">{t.name}</div><div className="lp-trole">{t.role}</div></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <div className="lp-cta-wrap lp-rv">
        <div className="lp-cta-card">
          <div className="lp-cta-glow" />
          <h2 className="lp-cta-t">Ready to start<br /><span className="lp-gtext">contributing?</span></h2>
          <p className="lp-cta-s">Join thousands of developers building their open-source portfolio. Free forever.</p>
          <div className="lp-cta-acts">
            {isAuthed ? (
              <a href="/dashboard" className="lp-btn lp-btn-p lp-btn-xl">Open Dashboard →</a>
            ) : (
              <button onClick={() => handleSignIn(showToast)} className="lp-btn lp-btn-p lp-btn-xl">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
                Continue with GitHub 🚀
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-fcopy">© 2026 OpenContrib · Built for open-source contributors worldwide</div>
        <div className="lp-flinks">
          <a onClick={() => document.getElementById("lp-features")?.scrollIntoView({ behavior: "smooth" })}>Features</a>
          <a onClick={() => document.getElementById("lp-howto")?.scrollIntoView({ behavior: "smooth" })}>How it works</a>
        </div>
      </footer>
    </>
  );
}