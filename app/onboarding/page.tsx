"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Check, Loader2, Target, UserRound } from "lucide-react";
import { MieruLogo } from "@/components/mieru-logo";
import { api, type Me } from "@/lib/api";

const ATS_OPTIONS = ["Greenhouse", "Lever", "Workable", "Ashby", "Google Sheets", "Other"];
const PAIN_POINTS = ["Resume volume", "Rubric drift", "Hiring manager alignment", "Evidence review", "Candidate comparison", "Audit trail"];

function ToggleGroup({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => onToggle(option)}
            className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
              active
                ? "border-[#151411] bg-[#151411] text-white"
                : "border-[#d8d1c3] bg-[#fbfaf7] text-[#4d473d] hover:border-[#b7ad9d]"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    full_name: "",
    work_email: "",
    job_title: "",
    company_name: "",
    company_website: "",
    company_size: "",
    industry: "",
    hiring_volume: "",
    primary_goal: "",
    consent: true,
  });
  const [atsTools, setAtsTools] = useState<string[]>([]);
  const [painPoints, setPainPoints] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [nextMe, profile] = await Promise.all([api.me(), api.getOnboardingProfile()]);
        if (!mounted) return;
        setMe(nextMe);
        setForm((current) => ({
          ...current,
          full_name: profile?.full_name || nextMe.name || "",
          work_email: profile?.work_email || nextMe.email || "",
          job_title: profile?.job_title || "",
          company_name: profile?.company_name || "",
          company_website: profile?.company_website || "",
          company_size: profile?.company_size || "",
          industry: profile?.industry || "",
          hiring_volume: profile?.hiring_volume || "",
          primary_goal: profile?.primary_goal || "",
          consent: profile?.consent ?? true,
        }));
        setAtsTools(Array.isArray(profile?.ats_tools) ? profile.ats_tools : []);
        setPainPoints(Array.isArray(profile?.pain_points) ? profile.pain_points : []);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Unable to load onboarding.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  function update(key: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggle(list: string[], setList: (next: string[]) => void, value: string) {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.saveOnboardingProfile({
        ...form,
        ats_tools: atsTools,
        pain_points: painPoints,
        complete: true,
      });
      router.replace("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save onboarding.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f2ea] text-[#151411]">
        <Loader2 className="animate-spin" size={24} />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f2ea] px-4 py-5 text-[#151411] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#ded8cc] bg-white px-4 py-3 shadow-sm">
          <MieruLogo />
          <form action="/auth/signout" method="post">
            <button className="rounded-lg border border-[#d8d1c3] px-3 py-2 text-xs font-bold text-[#4d473d] hover:bg-[#f8f4ec]">
              Sign out
            </button>
          </form>
        </header>

        <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="rounded-xl border border-[#ded8cc] bg-[#151411] p-5 text-white shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[.18em] text-[#c7b18b]">Workspace setup</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">Tune Mieru to your hiring motion.</h1>
            <p className="mt-3 text-sm leading-6 text-[#d6d0c5]">
              These details shape workspace defaults, recruiter notes, and how hiring context is stored against your organization.
            </p>
            <div className="mt-6 grid gap-3">
              {[
                { icon: UserRound, title: "Recruiter profile", copy: me?.email || "Authenticated account" },
                { icon: Building2, title: "Company context", copy: "Industry, size, workflow, and tools" },
                { icon: Target, title: "Decision goals", copy: "What the shortlist needs to make easier" },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-white/10 bg-white/[.06] p-3">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <item.icon size={15} className="text-[#c7b18b]" />
                    {item.title}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#d6d0c5]">{item.copy}</p>
                </div>
              ))}
            </div>
          </aside>

          <form onSubmit={submit} className="rounded-xl border border-[#ded8cc] bg-white p-5 shadow-sm">
            <div className="grid gap-4 md:grid-cols-2">
              {[
                ["full_name", "Full name", "Recruiter name"],
                ["work_email", "Work email", "name@company.com"],
                ["job_title", "Role", "Talent lead, founder, recruiter"],
                ["company_name", "Company name", "Company or hiring team"],
                ["company_website", "Company website", "https://company.com"],
                ["industry", "Industry", "SaaS, fintech, education"],
                ["company_size", "Company size", "1-20, 21-100, 101-500"],
                ["hiring_volume", "Hiring volume", "10 resumes/week, 250/role"],
              ].map(([key, label, placeholder]) => (
                <label key={key} className="block text-sm font-semibold text-[#2f2a22]">
                  {label}
                  <input
                    required={key === "company_name"}
                    value={String(form[key as keyof typeof form] || "")}
                    onChange={(event) => update(key as keyof typeof form, event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-[#d8d1c3] bg-[#fbfaf7] px-3 text-sm outline-none focus:border-[#151411]"
                    placeholder={placeholder}
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-[#2f2a22]">ATS and workflow tools</p>
                <div className="mt-2">
                  <ToggleGroup options={ATS_OPTIONS} selected={atsTools} onToggle={(value) => toggle(atsTools, setAtsTools, value)} />
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#2f2a22]">What should Mieru reduce?</p>
                <div className="mt-2">
                  <ToggleGroup options={PAIN_POINTS} selected={painPoints} onToggle={(value) => toggle(painPoints, setPainPoints, value)} />
                </div>
              </div>
            </div>

            <label className="mt-5 block text-sm font-semibold text-[#2f2a22]">
              Primary hiring goal
              <textarea
                value={form.primary_goal}
                onChange={(event) => update("primary_goal", event.target.value)}
                className="mt-1 min-h-24 w-full rounded-lg border border-[#d8d1c3] bg-[#fbfaf7] px-3 py-2 text-sm outline-none focus:border-[#151411]"
                placeholder="Example: reduce noisy PM shortlists and make evidence easier for hiring managers to inspect."
              />
            </label>

            <label className="mt-4 flex items-start gap-2 text-sm text-[#645d52]">
              <input
                type="checkbox"
                checked={form.consent}
                onChange={(event) => update("consent", event.target.checked)}
                className="mt-1"
              />
              Store this workspace profile so Mieru can preserve organization context and recruiter preferences.
            </label>

            {error && <p className="mt-4 rounded-lg border border-[#fecdca] bg-[#fef3f2] px-3 py-2 text-sm text-[#b42318]">{error}</p>}

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={saving || !form.company_name.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#151411] px-4 text-sm font-black text-white transition hover:bg-[#2a2823] disabled:opacity-60"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Finish onboarding
                {!saving ? <ArrowRight size={15} /> : null}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
