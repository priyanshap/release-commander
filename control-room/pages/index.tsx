import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  ShieldCheck, 
  Terminal as TerminalIcon, 
  Cpu, 
  GitBranch, 
  CheckCheck, 
  RotateCcw, 
  Activity, 
  Layers, 
  Lock, 
  Play, 
  CheckCircle2, 
  AlertOctagon, 
  Clock, 
  Zap, 
  Radio,
  FileCode2,
  GitPullRequest,
  Check,
  ChevronRight,
  Shield,
  Bot
} from 'lucide-react';

export default function ReleaseControlRoom() {
  const [stage, setStage] = useState<'idle' | 'investigating' | 'approval' | 'verified'>('idle');
  const [logs, setLogs] = useState<Array<{ text: string; type: 'info' | 'warn' | 'error' | 'success' | 'cmd'; time: string }>>([]);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'logs' | 'diff'>('logs');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(false);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  const addLog = (text: string, type: 'info' | 'warn' | 'error' | 'success' | 'cmd' = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { text, type, time }]);
  };

  useEffect(() => {
    terminalBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const startInvestigation = async () => {
    setStage('investigating');
    setLogs([]);
    setActiveStep(1);
    setActiveTab('logs');

    try {
      addLog("Connecting Control Room to TrueForge...", "cmd");

      const sessionResponse = await fetch("/api/trueforge-session", {
        method: "POST",
      });

      if (!sessionResponse.ok) {
        throw new Error(
          `TrueForge session creation failed (${sessionResponse.status})`
        );
      }

      const session = await sessionResponse.json();

      setSessionId(session.sessionId);

      addLog(
        `TrueForge session created: ${session.sessionId}`,
        "success"
      );

      addLog(
        "Agent profile linked: release-commander-demo",
        "info"
      );

      setActiveStep(2);

      addLog(
        "Inspecting exact release candidate: demo/broken-release",
        "info"
      );

      const investigationResponse = await fetch(
        "/api/release-investigate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: session.sessionId,
          }),
        }
      );

      const data = await investigationResponse.json();

      if (!investigationResponse.ok) {
        throw new Error(
          data?.error ||
          `Investigation failed (${investigationResponse.status})`
        );
      }

      setActiveStep(3);

      addLog(
        "Repository candidate checked out in ephemeral verification workspace",
        "info"
      );

      addLog(
        `Verifier: ${data.verification?.command ?? "python3 scripts/release_verify.py"}`,
        "cmd"
      );

      if (data.verification?.stdout) {
        addLog(
          data.verification.stdout,
          data.verdict === "RELEASE BLOCKED"
            ? "error"
            : "success"
        );
      }

      if (data.verification?.stderr) {
        addLog(
          data.verification.stderr.slice(0, 500),
          "warn"
        );
      }

      addLog(
        `Verifier exit code: ${data.verification?.exitCode}`,
        data.verification?.exitCode === 0
          ? "success"
          : "error"
      );

      if (data.verdict !== "RELEASE BLOCKED") {
        addLog(
          "Candidate is not blocked; no remediation approval required",
          "success"
        );

        setActiveStep(5);
        setStage('verified');
        return;
      }

      addLog(
        "RELEASE BLOCKED — deterministic policy failure confirmed",
        "error"
      );

      if (data.blocker) {
        addLog(
          `Blocker isolated: ${data.blocker}`,
          "warn"
        );
      }

      addLog(
        "Minimal remediation prepared: allowProductionRelease false → true",
        "info"
      );

      if (data.remoteGitHubModified === false) {
        addLog(
          "Remote GitHub repository unchanged",
          "info"
        );
      }

      setActiveStep(4);
      setStage('approval');
      setActiveTab('diff');

      addLog(
        "HALTED: explicit human authorisation required before mutation",
        "warn"
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown investigation error";

      addLog(
        `Release investigation error: ${message}`,
        "error"
      );

      setStage('idle');
      setActiveStep(0);
    }
  };

  const handleApprove = async () => {
    if (!sessionId) {
      addLog("Approval failed: no active TrueForge session", "error");
      return;
    }

    setStage('investigating');
    setActiveStep(4);
    setActiveTab('logs');

    addLog("Human authorisation granted", "cmd");
    addLog("Mutation boundary unlocked for approved patch only", "warn");
    addLog("Launching deterministic remediation in ephemeral workspace...", "info");

    try {
      const response = await fetch("/api/trueforge-approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
          `Approved remediation failed (${response.status})`
        );
      }

      addLog(
        `Approved patch: ${data.patch?.file ?? "release.config.json"}`,
        "cmd"
      );

      addLog(
        `${data.patch?.before ?? '"allowProductionRelease": false'} → ${data.patch?.after ?? '"allowProductionRelease": true'}`,
        "info"
      );

      addLog(
        `Verification: ${data.verification?.command ?? "python3 scripts/release_verify.py"}`,
        "cmd"
      );

      if (data.verification?.stdout) {
        addLog(
          data.verification.stdout.slice(0, 500),
          data.verdict === "SAFE TO SHIP" ? "success" : "error"
        );
      }

      if (data.verification?.stderr) {
        addLog(
          data.verification.stderr.slice(0, 500),
          "warn"
        );
      }

      addLog(
        `Verifier exit code: ${data.verification?.exitCode ?? "unknown"}`,
        data.verification?.exitCode === 0 ? "success" : "error"
      );

      if (data.verdict !== "SAFE TO SHIP") {
        addLog("RELEASE BLOCKED — deterministic verification failed", "error");
        addLog("No release action performed", "warn");

        setStage('approval');
        setActiveStep(4);
        return;
      }

      setActiveStep(5);

      addLog("SAFE TO SHIP (EXIT_CODE: 0)", "success");
      addLog("Approved remediation passed deterministic verification", "success");

      if (data.remoteGitHubModified === false) {
        addLog(
          "Remote GitHub repository unchanged",
          "info"
        );
      }

      addLog("Final Verdict: SAFE TO SHIP", "success");

      setStage('verified');

      confetti({
        particleCount: 160,
        spread: 100,
        origin: { y: 0.55 }
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown approval execution error";

      addLog(`Approved remediation error: ${message}`, "error");
      addLog("Release remains blocked", "warn");

      setStage('approval');
      setActiveStep(4);
    }
  };

  const resetAll = () => {
    setStage('idle');
    setLogs([]);
    setActiveStep(0);
    setActiveTab('logs');
    setSessionId(null);
    setShowEvidence(false);
  };

  return (
    <div className="min-h-screen bg-[#06080d] text-slate-100 font-sans selection:bg-amber-400 selection:text-black relative">
      
      {/* Ambient Lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/3 w-[600px] h-[400px] bg-gradient-to-b from-amber-500/15 via-orange-500/5 to-transparent blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-32 right-1/4 w-[600px] h-[400px] bg-gradient-to-t from-emerald-500/15 via-teal-500/5 to-transparent blur-[120px] rounded-full"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:3rem_3rem]"></div>

        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-300/30 to-transparent animate-[scan_7s_linear_infinite]" />
      </div>

      <div className="relative max-w-[1440px] mx-auto p-4 md:p-6 space-y-5">
        
        {/* Top Mission Control Bar */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-[#0a0e17]/90 backdrop-blur-2xl border border-slate-800/80 rounded-2xl gap-4 shadow-2xl">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 p-[1px] shadow-lg shadow-amber-500/20">
              <div className="w-full h-full bg-[#06080d] rounded-[11px] flex items-center justify-center text-amber-400">
                <Cpu className="w-6 h-6" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-black tracking-wider text-white uppercase font-mono">Release Commander</h1>
                <span className="flex items-center gap-1.5 text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-mono font-bold tracking-tight shadow-sm">
                  <Radio className="w-2.5 h-2.5 text-amber-400 animate-pulse" /> TRUEFORGE WORKFLOW
                </span>
              </div>
              <p className="text-xs text-slate-400">Autonomous Release Verification with Human Guardrails</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <div className="flex items-center gap-2.5 bg-[#101522] border border-slate-700/60 px-3.5 py-1.5 rounded-xl text-xs font-mono text-slate-300">
              <GitBranch className="w-3.5 h-3.5 text-amber-400" />
              <span>priyanshap/release-commander</span>
              <span className="text-slate-600">/</span>
              <span className="text-amber-400 font-bold">demo/broken-release</span>
            </div>

            <button 
              onClick={resetAll}
              className="p-2 rounded-xl bg-[#101522] border border-slate-700/60 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer active:scale-95"
              title="Reset State"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Premium Execution Breadcrumb */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#080c14]/95 px-5 py-4 shadow-xl">

          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px)] bg-[size:42px_42px]" />

          <div className="relative z-10 flex flex-col gap-3">

            <div className="flex items-center justify-between">
              <div className="font-mono text-[9px] font-black tracking-[0.18em] text-slate-500">
                RELEASE FLOW
              </div>

              <div
                className={`flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-[8px] font-black tracking-wider ${
                  stage === 'verified'
                    ? 'border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-300'
                    : stage === 'approval'
                    ? 'border-amber-500/30 bg-amber-500/[0.07] text-amber-300'
                    : stage === 'investigating'
                    ? 'border-cyan-500/30 bg-cyan-500/[0.07] text-cyan-300'
                    : 'border-slate-700 bg-slate-900 text-slate-500'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    stage === 'verified'
                      ? 'bg-emerald-400'
                      : stage === 'approval'
                      ? 'bg-amber-400 animate-pulse'
                      : stage === 'investigating'
                      ? 'bg-cyan-400 animate-pulse'
                      : 'bg-slate-600'
                  }`}
                />
                {stage === 'verified'
                  ? 'RELEASE VERIFIED'
                  : stage === 'approval'
                  ? 'HUMAN DECISION REQUIRED'
                  : stage === 'investigating'
                  ? 'TRUEFORGE EXECUTING'
                  : 'READY'}
              </div>
            </div>

            <div className="relative pt-2">

              {/* base line */}
              <div className="absolute left-[6%] right-[6%] top-[22px] h-px bg-slate-800" />

              {/* progress line */}
              <div
                className={`absolute left-[6%] top-[22px] h-px transition-all duration-700 ${
                  stage === 'verified'
                    ? 'right-[6%] bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.55)]'
                    : stage === 'approval'
                    ? 'right-[25%] bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.45)]'
                    : stage === 'investigating'
                    ? 'right-[45%] bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.45)]'
                    : 'right-[94%] bg-slate-700'
                }`}
              />

              <div className="grid grid-cols-5 gap-2">
                {[
                  ['01', 'MAP REPO', 1],
                  ['02', 'INVESTIGATE', 2],
                  ['03', 'VERIFY', 3],
                  ['04', 'HUMAN GATE', 4],
                  ['05', 'CLEARANCE', 5],
                ].map(([num, label, step]) => {
                  const numericStep = Number(step);
                  const complete = activeStep > numericStep || stage === 'verified';
                  const active = activeStep === numericStep && stage !== 'verified';
                  const blocked = stage === 'approval' && numericStep === 4;

                  return (
                    <div key={String(num)} className="relative z-10 flex flex-col items-center text-center">

                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full border font-mono text-[8px] font-black transition-all duration-500 ${
                          complete
                            ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                            : blocked
                            ? 'border-amber-400/70 bg-amber-500/10 text-amber-300 shadow-[0_0_14px_rgba(245,158,11,0.30)] animate-pulse'
                            : active
                            ? 'border-cyan-400/70 bg-cyan-500/10 text-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.28)] animate-pulse'
                            : 'border-slate-700 bg-[#0a0e17] text-slate-600'
                        }`}
                      >
                        {complete ? '✓' : num}
                      </div>

                      <div
                        className={`mt-2 font-mono text-[8px] font-black tracking-[0.08em] ${
                          complete
                            ? 'text-emerald-300'
                            : blocked
                            ? 'text-amber-300'
                            : active
                            ? 'text-cyan-300'
                            : 'text-slate-600'
                        }`}
                      >
                        {label}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid Content */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left Column (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            
            {/* Readiness Card */}
            <div className="bg-[#0a0e17]/95 backdrop-blur-2xl border border-slate-800/80 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" /> Release Readiness
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-extrabold tracking-wide ${
                  stage === 'verified' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 
                  stage === 'approval' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 
                  'bg-slate-800 text-slate-400'
                }`}>
                  {stage === 'verified' ? 'PASSING' : stage === 'approval' ? 'BLOCKED' : 'READY'}
                </span>
              </div>
              
              <div className="mt-4 flex items-baseline gap-3">
                <span className={`text-6xl font-black tracking-tight font-mono ${
                  stage === 'verified' ? 'text-emerald-400 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]' : 
                  stage === 'approval' ? 'text-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.4)]' : 
                  'text-slate-600'
                }`}>
                  {stage === 'verified' ? '100%' : stage === 'approval' ? '72%' : '0%'}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  {stage === 'verified' ? 'All CI assertions verified safe' : stage === 'approval' ? '1 Policy Blocker Detected' : 'Standing by for trigger'}
                </span>
              </div>

              <div className="mt-4 w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800 p-[1px]">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${
                    stage === 'verified' ? 'bg-gradient-to-r from-emerald-500 to-teal-400 w-full shadow-[0_0_15px_rgba(16,185,129,0.6)]' : 
                    stage === 'approval' ? 'bg-gradient-to-r from-amber-500 to-orange-400 w-[72%] shadow-[0_0_15px_rgba(245,158,11,0.6)]' : 
                    'w-0'
                  }`}
                ></div>
              </div>
            </div>

            {/* Badges */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0a0e17]/90 border border-slate-800/80 rounded-xl p-3 flex items-center gap-2.5 shadow-md">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">Qodo Merge</div>
                  <div className="text-xs font-mono font-bold text-slate-200">PR Reviewed</div>
                </div>
              </div>

              <div className="bg-[#0a0e17]/90 border border-slate-800/80 rounded-xl p-3 flex items-center gap-2.5 shadow-md">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase font-semibold">GitHub CI</div>
                  <div className="text-xs font-mono font-bold text-slate-200">Passing (11s)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            
            {/* Interactive Status Panel */}
            {stage === 'idle' && (
              <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-[#070b12] shadow-2xl">

                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:38px_38px]" />
                <div className="pointer-events-none absolute left-1/2 top-[30%] h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-cyan-500/[0.04] blur-[120px]" />

                {/* Header */}
                <div className="relative z-10 flex items-center justify-between border-b border-slate-800/80 px-5 py-3">
                  <div className="flex items-center gap-2 font-mono text-[9px] font-black tracking-[0.18em] text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    RELEASE CONTROL PLANE
                  </div>

                  <div className="flex items-center gap-2 font-mono text-[8px] tracking-wider text-slate-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    TRUEFORGE READY
                  </div>
                </div>

                <div className="relative z-10 px-5 pb-5 pt-6">

                  {/* Horizontal execution graph */}
                  <div className="relative mx-auto max-w-4xl">

                    <div className="absolute left-[9%] right-[9%] top-[72px] hidden h-px bg-slate-800 md:block" />

                    <div className="absolute left-[9%] right-[9%] top-[71px] hidden h-[2px] overflow-hidden md:block">
                      <div className="h-full w-[18%] bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent animate-[dataPulse_4s_linear_infinite]" />
                    </div>

                    <div className="relative grid grid-cols-2 gap-3 md:grid-cols-4">

                      <div className="group relative flex min-h-[145px] flex-col items-center justify-center rounded-xl border border-cyan-500/40 bg-[#09111b]/95 px-4 text-center transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/70 hover:shadow-[0_0_28px_rgba(34,211,238,0.10)]">
                        <GitBranch className="h-7 w-7 text-cyan-400" />
                        <div className="mt-4 font-mono text-[10px] font-black tracking-[0.10em] text-slate-200">
                          GITHUB MCP
                        </div>
                        <div className="mt-1 text-[9px] text-slate-600">
                          Repository Inspection
                        </div>
                        <span className="absolute bottom-[-4px] h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
                      </div>

                      <div className="group relative flex min-h-[145px] flex-col items-center justify-center rounded-xl border border-cyan-500/40 bg-[#09111b]/95 px-4 text-center transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/70 hover:shadow-[0_0_28px_rgba(34,211,238,0.10)]">
                        <Bot className="h-7 w-7 text-cyan-300" />
                        <div className="mt-4 font-mono text-[10px] font-black tracking-[0.10em] text-slate-200">
                          TRUEFORGE AGENT
                        </div>
                        <div className="mt-1 text-[9px] text-slate-600">
                          Release Analysis
                        </div>
                        <span className="absolute bottom-[-4px] h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.9)]" />
                      </div>

                      <div className="group relative flex min-h-[145px] flex-col items-center justify-center rounded-xl border border-blue-500/30 bg-[#09111b]/95 px-4 text-center transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/60 hover:shadow-[0_0_28px_rgba(59,130,246,0.10)]">
                        <TerminalIcon className="h-7 w-7 text-violet-400" />
                        <div className="mt-4 font-mono text-[10px] font-black tracking-[0.10em] text-slate-200">
                          SANDBOX
                        </div>
                        <div className="mt-1 text-[9px] text-slate-600">
                          Deterministic Verification
                        </div>
                        <span className="absolute bottom-[-4px] h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]" />
                      </div>

                      <div className="group relative flex min-h-[145px] flex-col items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/[0.025] px-4 text-center transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/60 hover:shadow-[0_0_28px_rgba(245,158,11,0.10)]">
                        <Lock className="h-7 w-7 text-amber-400" />
                        <div className="mt-4 font-mono text-[10px] font-black tracking-[0.10em] text-slate-200">
                          HUMAN GATE
                        </div>
                        <div className="mt-1 text-[9px] text-slate-600">
                          Mutation Authority
                        </div>
                        <div className="absolute right-3 top-3 font-mono text-[7px] tracking-wider text-amber-500/60">
                          LOCKED
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Live execution preview */}
                  <div className="mt-5 overflow-hidden rounded-xl border border-slate-800 bg-[#05080d]/95">

                    <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TerminalIcon className="h-3.5 w-3.5 text-slate-400" />
                        <span className="font-mono text-[9px] font-black tracking-[0.13em] text-slate-400">
                          LIVE EXECUTION FEED
                        </span>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-[8px] text-slate-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        AWAITING EXECUTION
                      </div>
                    </div>

                    <div className="space-y-2 px-4 py-4 font-mono text-[9px]">
                      <div className="flex gap-4">
                        <span className="text-slate-700">--:--:--</span>
                        <span className="text-cyan-500">○ SESSION</span>
                        <span className="text-slate-500">TrueForge workflow ready</span>
                      </div>

                      <div className="flex gap-4">
                        <span className="text-slate-700">--:--:--</span>
                        <span className="text-cyan-500">→ MCP</span>
                        <span className="text-slate-600">Repository target configured</span>
                      </div>

                      <div className="flex gap-4">
                        <span className="text-slate-700">--:--:--</span>
                        <span className="text-violet-400">→ SANDBOX</span>
                        <span className="text-slate-600">Verifier standing by</span>
                      </div>

                      <div className="flex gap-4">
                        <span className="text-slate-700">--:--:--</span>
                        <span className="text-amber-400">▣ GATE</span>
                        <span className="text-slate-600">Human authority enforced</span>
                      </div>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="mt-5">
                    <button
                      onClick={startInvestigation}
                      className="group relative w-full overflow-hidden rounded-xl border border-amber-300/60 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-6 py-3.5 text-[10px] font-black uppercase tracking-[0.14em] text-black shadow-[0_0_35px_rgba(245,158,11,0.18)] transition-all duration-300 hover:shadow-[0_0_50px_rgba(245,158,11,0.30)] active:scale-[0.995]"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        <Play className="h-4 w-4 fill-current" />
                        RUN RELEASE ANALYSIS
                      </span>

                      <div className="absolute inset-y-0 -left-1/3 w-1/4 skew-x-[-20deg] bg-white/35 blur-md transition-all duration-700 group-hover:left-[115%]" />
                    </button>

                    <div className="mt-2 text-center font-mono text-[8px] tracking-wider text-slate-700">
                      TrueForge sandbox · GitHub MCP · Human-gated mutation
                    </div>
                  </div>

                </div>
              </div>
            )}

            {stage === 'investigating' && (
              <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-[#070b12] shadow-[0_0_45px_rgba(34,211,238,0.07)]">

                <div className="absolute inset-0 bg-[linear-gradient(to_right,#22d3ee08_1px,transparent_1px),linear-gradient(to_bottom,#22d3ee08_1px,transparent_1px)] bg-[size:34px_34px]" />

                <div className="relative z-10 px-6 py-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-mono text-[9px] font-black tracking-[0.16em] text-cyan-300">
                        <Radio className="h-3 w-3 animate-pulse" />
                        TRUEFORGE EXECUTION ACTIVE
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        Building release evidence from the live agent session
                      </div>
                    </div>

                    <div className="rounded-full border border-cyan-500/20 bg-cyan-500/[0.05] px-3 py-1 font-mono text-[8px] text-cyan-300">
                      RUNNING
                    </div>
                  </div>

                  <div className="mt-8 grid grid-cols-3 gap-4">
                    {[
                      ['GITHUB MCP', 'Repository inspection'],
                      ['TRUEFORGE AGENT', 'Release analysis'],
                      ['SANDBOX', 'Deterministic verification'],
                    ].map(([title, desc], index) => (
                      <div
                        key={title}
                        className="relative overflow-hidden rounded-xl border border-slate-800 bg-[#0b111b]/90 px-4 py-4"
                      >
                        <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden">
                          <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-300 to-transparent animate-[dataPulse_2.2s_linear_infinite]" />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-mono text-[9px] font-black tracking-wider text-slate-300">
                              {title}
                            </div>
                            <div className="mt-1 text-[9px] text-slate-600">
                              {desc}
                            </div>
                          </div>

                          <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.9)] animate-pulse" />
                        </div>

                        {index < 2 && (
                          <div className="absolute -right-4 top-1/2 hidden h-px w-4 bg-cyan-500/40 md:block" />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-8">
                    <div className="relative h-[3px] overflow-hidden rounded-full bg-slate-900">
                      <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-cyan-300 to-transparent animate-[dataPulse_2.4s_linear_infinite]" />
                    </div>

                    <div className="mt-3 flex items-center justify-between font-mono text-[8px] tracking-wider text-slate-600">
                      <span>REPOSITORY</span>
                      <span>ANALYSIS</span>
                      <span>VERIFICATION</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {stage === 'approval' && (
              <div className="relative overflow-hidden rounded-2xl border-2 border-amber-400/70 bg-[#0d0904] shadow-[0_0_70px_rgba(245,158,11,0.14)]">

                {/* Frozen autonomy atmosphere */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.12),transparent_48%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#f59e0b08_1px,transparent_1px),linear-gradient(to_bottom,#f59e0b08_1px,transparent_1px)] bg-[size:34px_34px]" />

                <div className="relative z-10 p-5">

                  {/* Boundary banner */}
                  <div className="flex flex-col gap-4 border-b border-amber-500/20 pb-5 md:flex-row md:items-center md:justify-between">

                    <div className="flex items-start gap-4">
                      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-amber-400/50 bg-amber-500/10 text-amber-300 shadow-[0_0_35px_rgba(245,158,11,0.22)]">
                        <Lock className="h-6 w-6" />
                        <div className="absolute -inset-1 rounded-2xl border border-amber-400/20 animate-pulse" />
                      </div>

                      <div>
                        <div className="font-mono text-[9px] font-black tracking-[0.24em] text-amber-400">
                          AUTONOMY BOUNDARY REACHED
                        </div>

                        <h2 className="mt-1 text-2xl font-black tracking-tight text-white">
                          Release Commander has stopped.
                        </h2>

                        <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-400">
                          The blocker is understood and the remediation is ready.
                          The agent cannot cross the mutation boundary without explicit human authority.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-500/25 bg-black/25 px-4 py-3">
                      <div className="font-mono text-[8px] tracking-widest text-slate-600">
                        AGENT STATE
                      </div>
                      <div className="mt-1 flex items-center gap-2 font-mono text-[10px] font-black text-amber-300">
                        <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                        EXECUTION PAUSED
                      </div>
                    </div>
                  </div>

                  {/* Safety facts */}
                  <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">

                    {[
                      ['BLOCKER', '1 isolated'],
                      ['PATCH', '1-line change'],
                      ['REMOTE GITHUB', 'UNCHANGED'],
                      ['AUTHORITY', 'HUMAN ONLY'],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-slate-800 bg-[#070a0f]/85 px-3 py-3"
                      >
                        <div className="font-mono text-[8px] tracking-[0.14em] text-slate-600">
                          {label}
                        </div>

                        <div className={`mt-1 text-[10px] font-black ${
                          label === 'REMOTE GITHUB'
                            ? 'text-emerald-400'
                            : label === 'AUTHORITY'
                            ? 'text-amber-300'
                            : 'text-slate-300'
                        }`}>
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Diagnosis */}
                  <div className="mt-5 rounded-xl border border-red-500/20 bg-red-950/[0.12] p-4">
                    <div className="flex items-center justify-between">

                      <div className="flex items-center gap-3">
                        <AlertOctagon className="h-5 w-5 text-red-400" />

                        <div>
                          <div className="font-mono text-[8px] tracking-widest text-red-400">
                            RELEASE INTERCEPTED
                          </div>

                          <div className="mt-1 text-sm font-bold text-white">
                            Production release policy failed
                          </div>
                        </div>
                      </div>

                      <code className="rounded-lg border border-red-500/20 bg-black/30 px-3 py-2 font-mono text-[10px] text-red-300">
                        allowProductionRelease = false
                      </code>
                    </div>
                  </div>

                  {/* Diff */}
                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-[#05070a] shadow-inner">

                    <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileCode2 className="h-4 w-4 text-slate-500" />
                        <span className="font-mono text-[10px] text-slate-400">
                          release.config.json
                        </span>
                      </div>

                      <span className="rounded-full border border-amber-500/20 bg-amber-500/[0.06] px-2.5 py-1 font-mono text-[8px] font-bold text-amber-300">
                        MINIMAL REMEDIATION
                      </span>
                    </div>

                    <div className="space-y-1.5 p-4 font-mono text-[11px]">
                      <div className="text-slate-600">
                        @@ -3,5 +3,5 @@
                      </div>

                      <div className="rounded bg-slate-900/30 px-2 py-1 text-slate-500">
                        &quot;environment&quot;: &quot;production&quot;,
                      </div>

                      <div className="rounded border-l-2 border-red-400 bg-red-950/30 px-3 py-2 text-red-300">
                        - &quot;allowProductionRelease&quot;: false,
                      </div>

                      <div className="rounded border-l-2 border-emerald-400 bg-emerald-950/30 px-3 py-2 text-emerald-300">
                        + &quot;allowProductionRelease&quot;: true,
                      </div>

                      <div className="rounded bg-slate-900/30 px-2 py-1 text-slate-500">
                        &quot;requiredTests&quot;: [&quot;release configuration&quot;]
                      </div>
                    </div>
                  </div>

                  {/* Principle */}
                  <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] px-4 py-3 text-center font-mono text-[9px] font-bold tracking-[0.10em] text-amber-200">
                    THE AGENT KNOWS WHAT TO DO.
                    <span className="text-white"> KNOWLEDGE IS NOT AUTHORITY.</span>
                  </div>

                  {/* Decision controls */}
                  <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                    <div className="flex items-center gap-2 font-mono text-[8px] text-slate-600">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      sandbox-only remediation · remote repository protected
                    </div>

                    <div className="flex gap-3">

                      <button
                        onClick={resetAll}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-[10px] font-black tracking-wider text-slate-400 transition hover:border-red-500/40 hover:text-red-300"
                      >
                        DENY
                      </button>

                      <button
                        onClick={handleApprove}
                        className="group relative overflow-hidden rounded-xl border border-amber-300/70 bg-gradient-to-r from-amber-300 via-amber-400 to-orange-400 px-7 py-3 text-[10px] font-black tracking-[0.12em] text-black shadow-[0_0_35px_rgba(245,158,11,0.24)] transition-all hover:scale-[1.025] hover:shadow-[0_0_50px_rgba(245,158,11,0.34)] active:scale-[0.98]"
                      >
                        <span className="relative z-10 flex items-center gap-2">
                          <CheckCheck className="h-4 w-4" />
                          AUTHORISE MUTATION
                        </span>

                        <div className="absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-white/35 blur-md transition-all duration-700 group-hover:left-[120%]" />
                      </button>

                    </div>
                  </div>
                </div>
              </div>
            )}

            {stage === 'verified' && (
              <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-400/60 bg-[#04100a] shadow-[0_0_80px_rgba(16,185,129,0.12)]">

                {/* Clearance atmosphere */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(16,185,129,0.13),transparent_46%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b98108_1px,transparent_1px),linear-gradient(to_bottom,#10b98108_1px,transparent_1px)] bg-[size:36px_36px]" />

                {/* Animated clearance sweep */}
                <div className="absolute inset-x-0 top-0 h-[2px] overflow-hidden">
                  <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-emerald-300 to-transparent animate-[dataPulse_2.8s_linear_infinite]" />
                </div>

                <div className="relative z-10 p-5">

                  {/* Provenance bar */}
                  <div className="flex items-center justify-between border-b border-emerald-500/15 pb-4">

                    <div className="flex items-center gap-2 font-mono text-[9px] font-black tracking-[0.18em] text-emerald-300">
                      <ShieldCheck className="h-4 w-4" />
                      RELEASE CLEARANCE GRANTED
                    </div>

                    <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-1 font-mono text-[8px] font-bold text-emerald-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.9)] animate-pulse" />
                      VERIFIED
                    </div>
                  </div>

                  {/* Hero verdict */}
                  <div className="flex flex-col items-center py-5 text-center">

                    <div className="relative flex h-24 w-24 items-center justify-center">

                      <div className="absolute inset-0 rounded-full border border-emerald-400/15" />
                      <div className="absolute inset-[8px] rounded-full border border-dashed border-emerald-400/25 animate-[spin_20s_linear_infinite]" />
                      <div className="absolute inset-[19px] rounded-full border-2 border-emerald-400/50 shadow-[0_0_55px_rgba(16,185,129,0.16)]" />
                      <div className="absolute inset-[31px] rounded-full bg-emerald-500/[0.08]" />

                      <div className="relative">
                        <div className="font-mono text-2xl font-black tracking-tight text-emerald-300 drop-shadow-[0_0_16px_rgba(16,185,129,0.35)]">
                          100%
                        </div>
                        <div className="mt-1 font-mono text-[8px] font-bold tracking-[0.16em] text-emerald-500">
                          READINESS
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 font-mono text-[8px] font-black tracking-[0.24em] text-emerald-400">
                      FINAL RELEASE VERDICT
                    </div>

                    <h2 className="mt-1 text-3xl font-black tracking-[-0.04em] text-white drop-shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                      SAFE TO SHIP
                    </h2>

                    <p className="mt-1.5 max-w-xl text-[10px] leading-relaxed text-slate-400">
                      Human-authorised sandbox remediation completed and the release
                      verifier returned a successful final verdict.
                    </p>
                  </div>

                  {/* Verification facts */}
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">

                    {[
                      ['VERIFIER', 'EXIT CODE 0'],
                      ['SANDBOX', 'VERIFIED'],
                      ['AUTHORITY', 'HUMAN APPROVED'],
                      ['REMOTE GITHUB', 'UNCHANGED'],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-emerald-500/15 bg-[#06100b]/85 px-3 py-2.5"
                      >
                        <div className="font-mono text-[8px] tracking-[0.14em] text-slate-600">
                          {label}
                        </div>

                        <div className={`mt-1 flex items-center gap-1.5 text-[10px] font-black ${
                          label === 'REMOTE GITHUB'
                            ? 'text-slate-300'
                            : 'text-emerald-300'
                        }`}>
                          <Check className="h-3 w-3 text-emerald-400" />
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Final command proof */}
                  <div className="mt-3 flex flex-col gap-2 rounded-xl border border-emerald-500/20 bg-[#030806] px-4 py-2.5 md:flex-row md:items-center md:justify-between">

                    <div>
                      <div className="font-mono text-[8px] tracking-widest text-slate-600">
                        FINAL VERIFICATION
                      </div>

                      <code className="mt-1 block font-mono text-[10px] text-emerald-300">
                        python3 scripts/release_verify.py
                      </code>
                    </div>

                    <div className="font-mono text-[10px] font-black text-emerald-300">
                      SAFE TO SHIP · EXIT_CODE 0
                    </div>
                  </div>

                  {/* Evidence toggle */}
                  <div className="mt-3 flex justify-center">
                    <button
                      onClick={() => setShowEvidence(!showEvidence)}
                      className="group flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] px-5 py-2.5 font-mono text-[9px] font-black tracking-[0.12em] text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-500/[0.10]"
                    >
                      <FileCode2 className="h-3.5 w-3.5" />
                      {showEvidence ? 'HIDE EXECUTION EVIDENCE' : 'VIEW EXECUTION EVIDENCE'}
                      <ChevronRight className={`h-3.5 w-3.5 transition-transform ${showEvidence ? 'rotate-90' : ''}`} />
                    </button>
                  </div>

                  {/* Evidence Vault */}
                  {showEvidence && (
                    <div className="mt-5 overflow-hidden rounded-xl border border-slate-800 bg-[#030609] shadow-inner">

                      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-emerald-400" />
                          <span className="font-mono text-[9px] font-black tracking-[0.14em] text-slate-300">
                            EXECUTION EVIDENCE VAULT
                          </span>
                        </div>

                        <span className="font-mono text-[8px] text-emerald-500">
                          VERIFIED WORKFLOW
                        </span>
                      </div>

                      <div className="grid gap-px bg-slate-800 md:grid-cols-2">

                        <div className="bg-[#060a0f] p-4">
                          <div className="font-mono text-[8px] tracking-widest text-slate-600">
                            TRUEFORGE SESSION
                          </div>
                          <div className="mt-1 break-all font-mono text-[10px] text-cyan-300">
                            {sessionId || 'session unavailable'}
                          </div>
                        </div>

                        <div className="bg-[#060a0f] p-4">
                          <div className="font-mono text-[8px] tracking-widest text-slate-600">
                            RELEASE CANDIDATE
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-slate-300">
                            demo/broken-release
                          </div>
                        </div>

                        <div className="bg-[#060a0f] p-4">
                          <div className="font-mono text-[8px] tracking-widest text-slate-600">
                            INITIAL VERIFICATION
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-red-300">
                            RELEASE BLOCKED · EXIT_CODE 1
                          </div>
                        </div>

                        <div className="bg-[#060a0f] p-4">
                          <div className="font-mono text-[8px] tracking-widest text-slate-600">
                            FINAL VERIFICATION
                          </div>
                          <div className="mt-1 font-mono text-[10px] text-emerald-300">
                            SAFE TO SHIP · EXIT_CODE 0
                          </div>
                        </div>

                        <div className="bg-[#060a0f] p-4">
                          <div className="font-mono text-[8px] tracking-widest text-slate-600">
                            APPROVED MUTATION
                          </div>

                          <div className="mt-2 space-y-1 font-mono text-[9px]">
                            <div className="text-red-300">
                              - allowProductionRelease: false
                            </div>
                            <div className="text-emerald-300">
                              + allowProductionRelease: true
                            </div>
                          </div>
                        </div>

                        <div className="bg-[#060a0f] p-4">
                          <div className="font-mono text-[8px] tracking-widest text-slate-600">
                            SAFETY BOUNDARY
                          </div>

                          <div className="mt-2 space-y-1 text-[9px]">
                            <div className="flex items-center gap-2 text-emerald-300">
                              <Check className="h-3 w-3" />
                              Human approval recorded
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                              <Shield className="h-3 w-3 text-emerald-400" />
                              Remote GitHub unchanged
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Terminal Feed without bulky scrollbar */}
            <div className="bg-[#06080d] border border-slate-800/80 rounded-2xl p-4 font-mono text-xs shadow-2xl flex flex-col h-[210px]">
              <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-slate-800/60 text-slate-400">
                <span className="flex items-center gap-2 font-bold text-[11px] uppercase tracking-wider text-slate-300">
                  <TerminalIcon className="w-3.5 h-3.5 text-amber-400" /> TrueForge Sandbox Output Feed
                </span>
                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Verified workflow feed
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 select-text font-mono text-[11px] scrollbar-thin scrollbar-thumb-slate-800">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-600 italic">
                    Harness standby. Click &apos;Run Release Verification&apos; to trigger execution.
                  </div>
                ) : (
                  logs.map((l, i) => (
                    <div key={i} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-slate-600 select-none text-[10px]">{l.time}</span>
                      <span className="text-slate-500 select-none">&gt;</span>
                      <span className={`flex-1 ${
                        l.type === 'cmd' ? 'text-amber-300 font-bold' :
                        l.type === 'error' ? 'text-red-400 font-semibold' :
                        l.type === 'warn' ? 'text-orange-300 font-semibold' :
                        l.type === 'success' ? 'text-emerald-400 font-bold' :
                        'text-slate-300'
                      }`}>
                        {l.text}
                      </span>
                    </div>
                  ))
                )}
                <div ref={terminalBottomRef} />
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
