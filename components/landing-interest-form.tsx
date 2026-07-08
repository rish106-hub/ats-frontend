"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

export function LandingInterestForm() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    setError("");
    try {
      await api.saveInterest({
        email,
        company_name: company,
        role,
        source: "mieru_portal_landing",
        metadata_json: { page: "portal_root" },
      });
      setStatus("Interest saved. You can continue to signup whenever you are ready.");
      setEmail("");
      setCompany("");
      setRole("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save interest.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 gap-3 rounded-xl border border-[#ded8cc] bg-[#fffdf8] p-4 sm:grid-cols-2">
      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Work email"
        className="h-11 rounded-lg border border-[#d8d1c3] bg-white px-3 text-sm outline-none focus:border-[#151411]"
      />
      <input
        value={company}
        onChange={(event) => setCompany(event.target.value)}
        placeholder="Company"
        className="h-11 rounded-lg border border-[#d8d1c3] bg-white px-3 text-sm outline-none focus:border-[#151411]"
      />
      <input
        value={role}
        onChange={(event) => setRole(event.target.value)}
        placeholder="Your role"
        className="h-11 rounded-lg border border-[#d8d1c3] bg-white px-3 text-sm outline-none focus:border-[#151411]"
      />
      <button
        disabled={loading}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#151411] px-4 text-sm font-black text-white transition hover:bg-[#2a2823] disabled:opacity-60 sm:col-span-2"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : null}
        Join beta
        {!loading ? <ArrowRight size={15} /> : null}
      </button>
      {(status || error) && (
        <p className={`text-sm sm:col-span-2 ${error ? "text-[#b42318]" : "text-[#027a48]"}`}>{error || status}</p>
      )}
    </form>
  );
}
