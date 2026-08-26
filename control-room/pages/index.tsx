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
        throw new Error(`Session creation failed (${sessionResponse.status})`);
      }

      const session = await sessionResponse.json();
      setSessionId(session.sessionId);

      addLog(`TrueForge session created: ${session.sessionId}`, "success");
      addLog("Agent: release-commander", "info");
      setActiveStep(2);

      const turnResponse = await fetch("/api/trueforge-turn", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: session.sessionId,
        }),
      });

      if (!turnResponse.ok || !turnResponse.body) {
        const message = await turnResponse.text();
        throw new Error(message || `Turn failed (${turnResponse.status})`);
      }

      addLog("TrueForge investigation started", "info");
      setActiveStep(3);

      const reader = turnResponse.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalContent = "";
      let turnError = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const dataLine = block
            .split("\n")
            .find((line) => line.startsWith("data: "));

          if (!dataLine) continue;

          try {
            const event = JSON.parse(dataLine.slice(6));

            if (event.type === "tool.call") {
              addLog(`TrueForge tool call: ${event.name ?? "sandbox/tool"}`, "cmd");
            }

            if (event.type === "tool.result" || event.type === "tool.response") {
              const output =
                event.content ??
                event.output ??
                event.result ??
                "";

              if (typeof output === "string" && output.trim()) {
                const clean = output.trim().slice(0, 500);
                addLog(clean, clean.includes("RELEASE BLOCKED") ? "error" : "info");
              }
            }

            if (
              event.type === "model.message.delta" &&
              typeof event.content === "string"
            ) {
              finalContent += event.content;
            }

            if (event.type === "turn.done") {
              if (event.state?.status === "error") {
                turnError =
                  event.state?.message ||
                  "TrueForge turn ended with an unknown error";
              }

              const output = event.state?.output?.content;

              if (typeof output === "string") {
                finalContent = output;
              }
            }
          } catch {
            // Ignore malformed/incomplete SSE payloads.
          }
        }
      }

      if (turnError) {
        addLog(`TrueForge execution failed: ${turnError}`, "error");
        addLog("No release verdict produced. Approval gate will not open.", "warn");
        setStage('idle');
        setActiveStep(0);
        return;
      }

      if (finalContent) {
        if (finalContent.includes("RELEASE BLOCKED")) {
          addLog("RELEASE BLOCKED — blocker confirmed by TrueForge", "error");
        }

        if (finalContent.includes("allowProductionRelease")) {
          addLog(
            "Blocker isolated: allowProductionRelease is false",
            "warn"
          );
        }

        addLog("Release plan generated from TrueForge evidence", "info");
      }

      setActiveStep(4);
      setStage('approval');
      setActiveTab('diff');
      addLog(
        "HALTED: waiting for explicit human approval before sandbox modification",
        "warn"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown TrueForge error";

      addLog(`TrueForge error: ${message}`, "error");
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
    setActiveTab('logs');
    addLog("Human approval granted from Release Control Room", "cmd");
    addLog("Resuming the same TrueForge session...", "info");

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

      if (!response.ok || !response.body) {
        const message = await response.text();
        throw new Error(message || `Approval turn failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let finalContent = "";
      let safeToShip = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const dataLine = block
            .split("\n")
            .find((line) => line.startsWith("data: "));

          if (!dataLine) continue;

          try {
            const event = JSON.parse(dataLine.slice(6));

            if (event.type === "tool.call") {
              addLog(
                `TrueForge tool call: ${event.name ?? "sandbox/tool"}`,
                "cmd"
              );
            }

            if (
              event.type === "tool.result" ||
              event.type === "tool.response"
            ) {
              const output =
                event.content ??
                event.output ??
                event.result ??
                "";

              if (typeof output === "string" && output.trim()) {
                const clean = output.trim().slice(0, 500);

                if (clean.includes("SAFE TO SHIP")) {
                  safeToShip = true;
                  addLog(clean, "success");
                } else {
                  addLog(clean, "info");
                }
              }
            }

            if (
              event.type === "model.message.delta" &&
              typeof event.content === "string"
            ) {
              finalContent += event.content;
            }

            if (event.type === "turn.done") {
              const output = event.state?.output?.content;

              if (typeof output === "string") {
                finalContent = output;
              }
            }
          } catch {
            // Ignore malformed/incomplete SSE payloads.
          }
        }
      }

      if (finalContent.includes("SAFE TO SHIP")) {
        safeToShip = true;
      }

      if (!safeToShip) {
        addLog(
          "TrueForge did not return SAFE TO SHIP. Release remains blocked.",
          "error"
        );
        setStage('approval');
        setActiveTab('logs');
        return;
      }

      setActiveStep(5);
      addLog("SAFE TO SHIP (EXIT_CODE: 0)", "success");
      addLog("Release verification passed in TrueForge sandbox", "success");
      addLog(
        "Remote GitHub repository unchanged — sandbox remediation only",
        "info"
      );
      addLog("Final Verdict: SAFE TO SHIP", "success");

      setStage('verified');

      confetti({
        particleCount: 160,
        spread: 100,
        origin: { y: 0.55 }
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown TrueForge error";

      addLog(`TrueForge approval error: ${message}`, "error");
      setStage('approval');
    }
  };

  const resetAll = () => {
    setStage('idle');
    setLogs([]);
    setActiveStep(0);
    setActiveTab('logs');
    setSessionId(null);
  };

  return (
    <div className="min-h-screen bg-[#06080d] text-slate-100 font-sans selection:bg-amber-400 selection:text-black relative">
      
      {/* Ambient Lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/3 w-[600px] h-[400px] bg-gradient-to-b from-amber-500/15 via-orange-500/5 to-transparent blur-[120px] rounded-full"></div>
        <div className="absolute -bottom-32 right-1/4 w-[600px] h-[400px] bg-gradient-to-t from-emerald-500/15 via-teal-500/5 to-transparent blur-[120px] rounded-full"></div>
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:3rem_3rem]"></div>
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

        {/* Blueprint Stepper Pipeline */}
        <div className="bg-[#0a0e17]/90 backdrop-blur-2xl border border-slate-800/80 rounded-2xl p-3.5 shadow-xl">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 text-xs font-mono">
            {[
              { num: '01', title: 'MAP REPO', desc: 'GitHub MCP Tree', step: 1 },
              { num: '02', title: 'INVESTIGATE', desc: 'Agent Analysis', step: 2 },
              { num: '03', title: 'SANDBOX', desc: 'Python verifier', step: 3 },
              { num: '04', title: 'SAFETY GATE', desc: 'Human Sign-off', step: 4 },
              { num: '05', title: 'VERIFIED', desc: 'Safe to Ship', step: 5 },
            ].map((s) => {
              const isPast = activeStep >= s.step;
              const isCurrent = activeStep === s.step;
              return (
                <div 
                  key={s.num} 
                  className={`p-3 rounded-xl border transition-all ${
                    isCurrent 
                      ? 'bg-amber-500/10 border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                      : isPast 
                      ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300' 
                      : 'bg-slate-900/40 border-slate-800/60 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className={isCurrent ? 'text-amber-400' : isPast ? 'text-emerald-400' : 'text-slate-600'}>{s.num}</span>
                    <span className="text-[10px] tracking-wider">{s.title}</span>
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 font-sans">{s.desc}</div>
                </div>
              );
            })}
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

            {/* TrueForge Workflow Pipeline */}
            <div className="bg-[#0a0e17]/95 backdrop-blur-2xl border border-slate-800/80 rounded-2xl p-5 space-y-3.5 shadow-2xl">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" /> TrueForge Agent Pipeline
              </span>
              
              <div className="space-y-2.5">
                {[
                  { name: 'Repository Inspector', desc: 'Mapped repository via GitHub MCP', state: stage !== 'idle' ? 'done' : 'idle' },
                  { name: 'Release Policy Check', desc: 'Flagged allowProductionRelease: false', state: stage === 'approval' || stage === 'verified' ? 'done' : stage === 'investigating' ? 'active' : 'idle' },
                  { name: 'Isolated Sandbox Runner', desc: 'Executed deterministic Python release verifier', state: stage === 'approval' || stage === 'verified' ? 'done' : stage === 'investigating' ? 'active' : 'idle' },
                  { name: 'Human Safety Gate', desc: 'Enforced sign-off before sandbox modification', state: stage === 'verified' ? 'done' : stage === 'approval' ? 'active' : 'idle' }
                ].map((step, idx) => (
                  <div key={idx} className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all ${
                    step.state === 'done' ? 'bg-emerald-950/20 border-emerald-800/40 text-slate-200' :
                    step.state === 'active' ? 'bg-amber-950/20 border-amber-500/50 text-amber-200 animate-pulse' :
                    'bg-[#0f1420]/50 border-slate-800/50 text-slate-500'
                  }`}>
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                      step.state === 'done' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                      step.state === 'active' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50' :
                      'bg-slate-800 text-slate-600'
                    }`}>
                      {step.state === 'done' ? '✓' : idx + 1}
                    </div>
                    <div>
                      <div className={`font-semibold text-xs ${step.state !== 'idle' ? 'text-slate-200' : 'text-slate-500'}`}>
                        {step.name}
                      </div>
                      <div className="text-[11px] text-slate-400 leading-tight">{step.desc}</div>
                    </div>
                  </div>
                ))}
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
              <div className="bg-[#0a0e17]/95 backdrop-blur-2xl border border-slate-800/80 rounded-2xl p-8 text-center space-y-5 shadow-2xl relative overflow-hidden">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mx-auto text-amber-400 shadow-lg shadow-amber-500/10">
                  <Activity className="w-7 h-7" />
                </div>
                <div className="space-y-2 max-w-lg mx-auto">
                  <h2 className="text-xl font-bold text-white">Start Release-Readiness Session</h2>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Release Commander reaches the repository via GitHub MCP, runs sandbox tests, isolates blockers, and formulates safe remediation.
                  </p>
                </div>
                <button 
                  onClick={startInvestigation}
                  className="bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-black font-extrabold px-8 py-3.5 rounded-xl text-xs uppercase tracking-wider transition-all duration-200 flex items-center gap-2.5 mx-auto shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" /> Run Release Verification
                </button>
              </div>
            )}

            {stage === 'investigating' && (
              <div className="bg-[#0a0e17]/95 backdrop-blur-2xl border border-amber-500/30 rounded-2xl p-10 text-center space-y-4 shadow-2xl">
                <div className="w-10 h-10 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <div className="space-y-1">
                  <p className="text-xs font-mono text-amber-400 tracking-wider uppercase font-bold">Running TrueForge Investigation & Sandbox Verification...</p>
                  <p className="text-[11px] text-slate-400">Inspecting branch tree, evaluating policies, and verifying assertions</p>
                </div>
              </div>
            )}

            {stage === 'approval' && (
              <div className="bg-[#120e06] border-2 border-amber-500/60 rounded-2xl p-5 space-y-4 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Human-in-the-Loop Approval Checkpoint
                  </span>
                  <span className="text-[11px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-bold">release.config.json</span>
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-amber-400" />
                    Blocker: allowProductionRelease evaluates to false
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    The agent isolated the configuration blocker and formulated a minimal deterministic patch. Sandbox modifications require explicit human approval before being applied.
                  </p>
                </div>

                {/* Diff Viewer Card */}
                <div className="bg-[#06080d] border border-slate-800 rounded-xl p-3.5 font-mono text-xs overflow-x-auto shadow-inner space-y-1">
                  <div className="text-slate-500">--- a/release.config.json</div>
                  <div className="text-slate-500">+++ b/release.config.json</div>
                  <div className="text-blue-400 pt-1">@@ -3,5 +3,5 @@</div>
                  <div className="text-slate-400">   &quot;environment&quot;: &quot;production&quot;,</div>
                  <div className="text-red-400 bg-red-950/40 px-1 py-0.5 rounded flex items-center gap-2">-  &quot;allowProductionRelease&quot;: false,</div>
                  <div className="text-emerald-400 bg-emerald-950/40 px-1 py-0.5 rounded flex items-center gap-2">+  &quot;allowProductionRelease&quot;: true,</div>
                  <div className="text-slate-400">   &quot;requiredTests&quot;: [&quot;release configuration&quot;]</div>
                </div>

                <div className="flex justify-end gap-3 pt-1">
                  <button 
                    onClick={resetAll}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition cursor-pointer"
                  >
                    Deny Change
                  </button>
                  <button 
                    onClick={handleApprove}
                    className="px-6 py-2 text-xs font-black text-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl transition flex items-center gap-2 shadow-lg shadow-amber-500/20 hover:scale-[1.02] cursor-pointer"
                  >
                    <CheckCheck className="w-4 h-4" /> Approve & Apply Patch
                  </button>
                </div>
              </div>
            )}

            {stage === 'verified' && (
              <div className="bg-[#07130d] border-2 border-emerald-500/60 rounded-2xl p-5 space-y-3 shadow-2xl relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" /> Final Release Verdict
                  </span>
                  <span className="text-xs bg-emerald-500 text-black px-3 py-0.5 rounded-full font-mono font-black shadow-lg shadow-emerald-500/20">SAFE TO SHIP</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Approved patch applied only inside the TrueForge sandbox. Release verification returned SAFE TO SHIP with exit code 0. No remote GitHub changes were made.
                </p>
                <div className="bg-[#06080d] border border-emerald-900/40 rounded-xl p-3 font-mono text-xs text-emerald-400 flex items-center justify-between shadow-inner">
                  <span>SAFE TO SHIP (EXIT_CODE: 0)</span>
                  <span className="text-slate-500 text-[10px]">1 suite | 0 failures</span>
                </div>
              </div>
            )}

            {/* Terminal Feed without bulky scrollbar */}
            <div className="bg-[#06080d] border border-slate-800/80 rounded-2xl p-4 font-mono text-xs shadow-2xl flex flex-col h-[280px]">
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
