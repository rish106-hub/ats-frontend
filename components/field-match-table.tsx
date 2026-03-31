"use client";

import { type CandidateResult, type PreviewResults } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";

const MATCH_STYLE = {
  pass: { icon: "✅", cls: "text-green-400" },
  fail: { icon: "❌", cls: "text-red-400" },
  partial: { icon: "⚠️", cls: "text-yellow-400" },
};

const CLASS_STYLE = {
  P0: "bg-green-800 text-green-100",
  Baseline: "bg-blue-800 text-blue-100",
  Reject: "bg-red-900 text-red-200",
};

function CandidateCard({ c }: { c: CandidateResult }) {
  const [open, setOpen] = useState(false);
  const style = CLASS_STYLE[c.classification] ?? "bg-zinc-700 text-zinc-200";

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900 hover:bg-zinc-800 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm text-zinc-100">{c.candidate_name || "Unknown"}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style}`}>
            {c.classification}
          </span>
          {!c.baseline_pass && (
            <span className="text-xs text-red-400">Baseline fail</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-zinc-400">
          <span>Score: <span className="text-zinc-100 font-mono">{c.overall_score}/100</span></span>
          <span>P0: <span className="text-zinc-100 font-mono">{c.p0_score}</span></span>
          <span className="text-zinc-600">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="bg-zinc-950 px-4 py-3 space-y-3">
          {c.reasoning && (
            <p className="text-zinc-400 text-xs italic border-l-2 border-zinc-700 pl-3">{c.reasoning}</p>
          )}

          {c.baseline_failures?.length > 0 && (
            <div className="text-xs text-red-400">
              Baseline failures: {c.baseline_failures.join(", ")}
            </div>
          )}
          {c.p0_matches?.length > 0 && (
            <div className="text-xs text-green-400">
              P0 matches: {c.p0_matches.join(", ")}
            </div>
          )}
          {c.extra_param_matches?.length > 0 && (
            <div className="text-xs text-purple-400">
              Extra param matches: {c.extra_param_matches.join(", ")}
            </div>
          )}

          {c.field_matches?.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-400 text-xs w-28">Field</TableHead>
                  <TableHead className="text-zinc-400 text-xs">Resume Value</TableHead>
                  <TableHead className="text-zinc-400 text-xs">Criteria Checked</TableHead>
                  <TableHead className="text-zinc-400 text-xs w-24">Match</TableHead>
                  <TableHead className="text-zinc-400 text-xs">Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.field_matches.map((fm, i) => {
                  const m = MATCH_STYLE[fm.match] ?? { icon: "—", cls: "text-zinc-400" };
                  return (
                    <TableRow key={i} className="border-zinc-800 align-top">
                      <TableCell className="text-zinc-300 text-xs font-mono py-2">{fm.field}</TableCell>
                      <TableCell className="text-zinc-400 text-xs py-2 max-w-[180px] break-words">{fm.value_from_resume}</TableCell>
                      <TableCell className="text-zinc-400 text-xs py-2 max-w-[180px] break-words">{fm.criteria_checked}</TableCell>
                      <TableCell className={`text-xs py-2 font-medium ${m.cls}`}>{m.icon} {fm.match}</TableCell>
                      <TableCell className="text-zinc-500 text-xs py-2">{fm.note}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </div>
  );
}

export function FieldMatchTable({ results }: { results: PreviewResults }) {
  const { summary, results: candidates } = results;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Evaluated", value: summary.total_evaluated, cls: "text-zinc-100" },
          { label: "P0", value: summary.p0_count, cls: "text-green-400" },
          { label: "Baseline", value: summary.baseline_count, cls: "text-blue-400" },
          { label: "Reject", value: summary.reject_count, cls: "text-red-400" },
        ].map(({ label, value, cls }) => (
          <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
            <div className={`text-2xl font-bold font-mono ${cls}`}>{value}</div>
            <div className="text-zinc-500 text-xs mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {candidates.map((c, i) => <CandidateCard key={i} c={c} />)}
      </div>
    </div>
  );
}
