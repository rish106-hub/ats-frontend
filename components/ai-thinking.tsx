"use client";

import { useEffect, useState } from "react";

const FACTS = [
  "AI processes each resume in under 3 seconds.",
  "Structured scoring removes 40% of unconscious bias.",
  "P0 candidates have 3× higher offer acceptance rates.",
  "AI screening cuts time-to-hire by an average of 60%.",
  "Every candidate is evaluated against identical criteria.",
  "Field-level scoring captures nuance manual reviews miss.",
  "Bad hires cost up to 30% of their annual salary.",
  "Iterative rubrics improve shortlist quality by 26%.",
  "Parallel evaluation scores all candidates simultaneously.",
  "Your rubric evolves — each iteration sharpens precision.",
];

/* Animated neural SVG icon */
function NeuralIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="23" stroke="rgba(79,110,247,0.2)" strokeWidth="1" />
      {/* Nodes */}
      {[
        [24, 8], [8, 20], [40, 20], [16, 32], [32, 32], [24, 42],
      ].map(([cx, cy], i) => (
        <circle
          key={i} cx={cx} cy={cy} r="3.5"
          fill="#4f6ef7" opacity={0.8}
          style={{ animation: `nh-neural-pulse 2s ease-in-out ${i * 0.35}s infinite` }}
        />
      ))}
      {/* Connections */}
      {[
        [24,8, 8,20], [24,8, 40,20],
        [8,20, 16,32], [8,20, 32,32],
        [40,20, 16,32], [40,20, 32,32],
        [16,32, 24,42], [32,32, 24,42],
      ].map(([x1,y1,x2,y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke="rgba(79,110,247,0.35)" strokeWidth="1" />
      ))}
    </svg>
  );
}

interface AiThinkingProps {
  label?: string;
  scored?: number;
  total?: number;
}

export function AiThinking({ label = "Evaluating candidates…", scored, total }: AiThinkingProps) {
  const [factIdx, setFactIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setFactIdx(n => (n + 1) % FACTS.length);
        setVisible(true);
      }, 300);
    }, 4500);
    return () => clearInterval(iv);
  }, []);

  const pct = total && total > 0 ? Math.round((scored! / total) * 100) : 0;
  const showProgress = scored !== undefined && total !== undefined && total > 0;

  return (
    <div className="space-y-6">
      {/* Neural + label */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative nh-float">
          <NeuralIcon />
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(79,110,247,0.18) 0%, transparent 70%)",
              animation: "nh-glow-pulse 3s ease-in-out infinite",
            }}
          />
        </div>

        {/* Bouncing dots */}
        <div className="flex gap-1.5 items-center">
          {[0, 1, 2].map(d => (
            <span
              key={d}
              className="w-1.5 h-1.5 rounded-full bg-blue-500"
              style={{ animation: `nh-bounce-dot 1.3s ease-in-out ${d * 0.2}s infinite` }}
            />
          ))}
        </div>

        <p className="text-[#c8d8f0] text-sm font-medium text-center">{label}</p>
      </div>

      {/* Progress bar */}
      {showProgress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#566b99]">{scored} of {total} candidates</span>
            <span className="font-mono font-bold text-blue-400">{pct}%</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(79,110,247,0.1)" }}>
            <div
              className="h-full rounded-full nh-progress-bar"
              style={{ width: `${pct || 2}%` }}
            />
          </div>
        </div>
      )}

      {/* Rotating fact */}
      <div
        className="nh-inset px-5 py-4 text-center transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <p className="text-xs text-[#566b99] leading-relaxed">
          <span className="text-blue-400/60 font-semibold uppercase tracking-widest text-[9px] block mb-1">Did you know</span>
          {FACTS[factIdx]}
        </p>
      </div>
    </div>
  );
}
