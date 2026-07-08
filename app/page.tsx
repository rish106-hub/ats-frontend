import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Brain,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  FileSearch,
  Gauge,
  Languages,
  MessageSquareText,
  ShieldAlert,
  UsersRound,
} from "lucide-react";
import { LandingInterestForm } from "@/components/landing-interest-form";
import { MieruLogo } from "@/components/mieru-logo";

const roleChips = ["Product", "Engineering", "Sales", "Design", "Data", "Operations"];
const roleMarquee = [...roleChips, ...roleChips, ...roleChips];
const signalStrip = [
  "Rubric versions",
  "Resume proof",
  "Private notes",
  "Decision packets",
  "Hard filters",
  "Evidence trails",
  "Calibration",
  "Shortlist review",
];

const candidateRows = [
  ["Aarav Mehta", "Priority", "Product ownership shown in two shipped features", "pass"],
  ["Nisha Rao", "Review", "Metrics present, but launch scope needs verification", "review"],
  ["Dev Sinha", "Reject", "No direct PM ownership evidence found", "fail"],
];

const evidenceRows = [
  ["Role fit", "Good", "Owned roadmap slices and shipped customer-facing feature."],
  ["Hard filter", "Review", "Institution proof is unclear; verify before advancing."],
  ["Red flag", "Clean", "No unexplained gap or contradictory role evidence found."],
];

const scoreRows = ["Shipped customer feature", "Product metrics", "Stakeholder ownership"];

const featureBlocks = [
  {
    title: "Built on role-specific rubrics",
    copy: "Start from the JD, then teach the model what your hiring team rewards, relaxes, or rejects.",
    icon: Gauge,
  },
  {
    title: "Every score has evidence",
    copy: "Hard filters, review signals, and red flags stay tied to resume snippets instead of hidden reasoning.",
    icon: FileSearch,
  },
  {
    title: "PDF review without tab chaos",
    copy: "Open the resume beside the candidate evidence, with private notes stored against that resume.",
    icon: BookOpenCheck,
  },
  {
    title: "2-minute shortlist summary",
    copy: "See the candidate’s decision status, confidence, strongest signal, and blocker in a compact report.",
    icon: ClipboardCheck,
  },
  {
    title: "Plain-language calibration",
    copy: "Recruiters can write instructions naturally and confirm exactly how the rubric will change.",
    icon: MessageSquareText,
  },
  {
    title: "Works across roles",
    copy: "Product, engineering, sales, data, marketing, ops, HR, finance, and legal workflows fit the same evidence engine.",
    icon: BriefcaseBusiness,
  },
];

const antiRisk = [
  "No evidence quote",
  "Missing source field",
  "Conflicting parsed facts",
  "Scanned or low-text PDF",
  "Rubric drift",
  "Unclear recruiter preference",
  "Sensitive proxy signal",
  "Model incomplete response",
];

const roleCards = [
  ["Product Manager", "Ownership, launch judgment, metrics, stakeholder depth"],
  ["Software Engineer", "Production systems, code ownership, architecture evidence"],
  ["Sales", "Quota ownership, pitch quality, objection handling, CRM hygiene"],
  ["Data Analyst", "SQL depth, business metrics, dashboarding, decision impact"],
  ["Marketing", "Channel ownership, experiments, CAC/LTV thinking, creative signal"],
  ["Operations", "Process design, execution rigor, cross-functional reliability"],
];

const comparison = [
  ["Manual shortlist", "JD read", "Resume skim", "Spreadsheet notes", "Hiring manager debate", "Rework unclear criteria"],
  ["Mieru shortlist", "JD parsed", "Rubric calibrated", "Evidence cards", "Decision packet", "Notes preserved"],
];

export default function LandingPage() {
  return (
    <main className="mi-page bg-[#fff7e8] text-[#24140f]">
      <section className="mi-hero text-white">
        <nav className="mi-nav mi-shell flex items-center justify-between gap-4 py-5">
          <MieruLogo inverse />
          <div className="hidden items-center gap-6 text-sm font-semibold text-[#f7d8ad] md:flex">
            <a href="#product" className="hover:text-white">Product</a>
            <a href="#why" className="hover:text-white">Why Mieru?</a>
            <a href="#roles" className="hover:text-white">Roles</a>
            <a href="#workflow" className="hover:text-white">Workflow</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden min-h-11 items-center rounded-full border border-white/20 px-4 py-2 text-sm font-bold leading-5 text-white transition hover:bg-white/10 sm:inline-flex">
              Log in
            </Link>
            <Link href="/signup" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#fff7e8] px-4 py-2 text-sm font-black leading-5 text-[#24140f] transition hover:bg-white">
              Start workspace <ArrowRight size={15} />
            </Link>
          </div>
        </nav>

        <div className="mi-hero-layout mi-shell grid min-h-[calc(min(780px,92vh)-92px)] items-center gap-8 py-10 lg:grid-cols-[minmax(0,1fr)_470px]">
          <div className="mi-hero-copy min-w-0 max-w-3xl">
            <p className="mi-reveal inline-flex rounded-full border border-[#ffcc7a]/30 bg-[#3a1c10]/70 px-3 py-1 text-xs font-black uppercase text-[#ffcc7a]">
              Built for 250-resume hiring loops
            </p>
            <h1 className="mi-reveal mi-delay-1 mt-5 max-w-3xl text-5xl font-black leading-[1.02] sm:text-6xl lg:text-7xl">
              Never shortlist blind again. Mieru shows the proof.
            </h1>
            <p className="mi-reveal mi-delay-2 mt-5 max-w-2xl text-base leading-7 text-[#f8ead5] sm:text-lg">
              A recruiter-first workspace that turns job descriptions, resume PDFs, and recruiter preferences into evidence-backed shortlist decisions.
            </p>
            <div className="mi-reveal mi-delay-3 mt-7 flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#fff7e8] px-5 py-2.5 text-sm font-black leading-5 text-[#24140f] transition hover:bg-white">
                Create account <ArrowRight size={16} />
              </Link>
              <a href="#product" className="inline-flex min-h-11 items-center rounded-full border border-white/25 px-5 py-2 text-sm font-bold leading-5 text-white transition hover:bg-white/10">
                See product
              </a>
            </div>
            <div className="mi-reveal mi-delay-4 mt-7 max-w-xl overflow-hidden">
              <div className="mi-chip-marquee" aria-label="Supported hiring roles">
                <div className="mi-chip-track">
                  {roleMarquee.map((chip, index) => (
                    <span key={`${chip}-${index}`} className="rounded-full border border-[#ffcc7a]/20 bg-[#24140f]/55 px-3 py-1 text-xs font-bold text-[#f7d8ad]">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mi-hero-card mi-float-card min-w-0">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <MieruLogo inverse />
              <span className="mi-live-pill rounded-full border border-[#82d89a]/30 bg-[#073a21] px-2.5 py-1 text-[11px] font-black text-[#a7efba]">Evidence ready</span>
            </div>
            <div className="mt-4 grid gap-3">
              {candidateRows.map(([name, status, copy, tone]) => (
                <div key={name} className="mi-candidate-row rounded-2xl border border-white/10 bg-white/[.06] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 break-words text-sm font-black leading-5">{name}</p>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${
                      tone === "pass"
                        ? "border-[#82d89a]/40 bg-[#073a21] text-[#a7efba]"
                        : tone === "fail"
                          ? "border-[#ffb4a8]/35 bg-[#4a120b] text-[#ffb4a8]"
                          : "border-[#ffd37a]/35 bg-[#4a3109] text-[#ffd37a]"
                    }`}>
                      {status}
                    </span>
                  </div>
                  <p className="mt-2 break-words text-xs leading-5 text-[#f8ead5]">{copy}</p>
                </div>
              ))}
            </div>
            <div className="mi-instruction-card mt-4 rounded-2xl border border-[#ffcc7a]/20 bg-[#2a140d] p-4">
              <p className="text-[11px] font-black uppercase text-[#ffcc7a]">Recruiter instruction</p>
              <p className="mt-2 text-sm text-[#fff7e8]">Only advance candidates with direct product evidence and clear institution proof.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mi-trust-strip border-y border-[#ead6bd] bg-[#fffaf0] py-5">
        <div className="mi-shell flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-black uppercase text-[#9c5a1c]">For recruiters who need evidence before interviews</p>
          <div className="mi-signal-marquee text-xs font-bold text-[#7d6a58]">
            <div className="mi-signal-track">
              {[...signalStrip, ...signalStrip].map((item, index) => (
                <span key={`${item}-${index}`}>{item}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="product" className="py-14 sm:py-16">
        <div className="mi-shell">
          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="mi-reveal">
              <p className="text-xs font-black uppercase text-[#bd641f]">End-to-end shortlist desk</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">Everything you need to shortlist automatically, without losing control.</h2>
              <p className="mt-3 text-sm leading-6 text-[#6f5c4c]">
                Interview automation starts too late if the shortlist is noisy. Mieru sits one step earlier: it makes resume evidence visible, calibrated, and reviewable before recruiter time is spent.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {featureBlocks.map((item) => (
                <article key={item.title} className="mi-card mi-hover-lift mi-reveal p-4">
                  <span className="mi-icon-disc">
                    <item.icon size={18} />
                  </span>
                  <h3 className="mt-4 text-lg font-black">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#6f5c4c]">{item.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="why" className="border-y border-[#ead6bd] bg-[#24140f] py-14 text-white sm:py-16">
        <div className="mi-shell grid gap-7 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <div className="mi-report-shell mi-reveal min-w-0 rounded-[28px] border border-white/10 bg-[#170c08] p-4">
            <div className="mi-report-card rounded-[22px] border border-[#ffcc7a]/20 bg-[#fff7e8] p-4 text-[#24140f]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase text-[#bd641f]">Evaluation report</p>
                  <h3 className="mt-2 text-2xl font-black">Detailed and instance-backed candidate decision</h3>
                </div>
                <span className="mi-score-badge rounded-full border border-[#9ed9ad] bg-[#eaf8ed] px-2.5 py-1 text-xs font-black text-[#067232]">Strong maybe</span>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-[190px_minmax(0,1fr)]">
                <div className="mi-score-card rounded-2xl border border-[#ead6bd] bg-white p-4">
                  <p className="text-[11px] font-black uppercase text-[#bd641f]">Final signal</p>
                  <p className="mt-3 text-5xl font-black">82</p>
                  <p className="mt-1 text-sm text-[#6f5c4c]">Priority with verification</p>
                </div>
                <div className="grid gap-2">
                  {evidenceRows.map(([label, score, note]) => (
                    <div key={label} className="mi-evidence-row grid gap-2 rounded-xl border border-[#ead6bd] bg-[#fffaf0] px-3 py-2 sm:grid-cols-[86px_72px_minmax(0,1fr)]">
                      <span className="break-words text-xs font-black leading-5 text-[#7d6a58]">{label}</span>
                      <span className="rounded-full bg-[#24140f] px-2 py-0.5 text-center text-[10px] font-black text-white">{score}</span>
                      <span className="break-words text-sm leading-5 text-[#4f4034]">{note}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mi-scorecard mt-4 rounded-2xl border border-[#ead6bd] bg-white p-4">
                <p className="text-xs font-black uppercase text-[#bd641f]">Evidence scorecard</p>
                <div className="mt-3 grid gap-2">
                  {scoreRows.map((row, index) => (
                    <div key={row} className="grid gap-2 text-sm sm:grid-cols-[minmax(0,1fr)_48px_110px]">
                      <span className="break-words leading-5">{row}</span>
                      <span className="font-black">{index === 1 ? "3/5" : "4/5"}</span>
                      <span className="break-words leading-5 text-[#6f5c4c]">{index === 1 ? "Thin proof" : "Evidence found"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mi-reveal mi-delay-1">
            <p className="text-xs font-black uppercase text-[#ffcc7a]">Evidence over explanation</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">The recruiter sees the decision packet, not a wall of AI prose.</h2>
            <p className="mt-3 text-sm leading-6 text-[#f8ead5]">
              Outputs are short, color-coded, and grounded. If the resume does not prove a claim, Mieru marks it as review or insufficient evidence instead of pretending.
            </p>
            <div className="mt-5 grid gap-2">
              {[
                "Pass appears green only when the resume has a supporting line.",
                "Review appears amber when evidence is partial or needs recruiter confirmation.",
                "Reject appears red when a hard filter clearly fails.",
              ].map((item) => (
                <div key={item} className="mi-proof-line flex items-center gap-2 text-sm font-semibold text-[#fff7e8]">
                  <CheckCircle2 size={16} className="text-[#a7efba]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="roles" className="py-14 sm:py-16">
        <div className="mi-shell">
          <div className="mi-reveal flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase text-[#bd641f]">Role tailored</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">Resume review tailored for every role.</h2>
            </div>
            <Link href="/signup" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-[#24140f] px-4 py-2.5 text-sm font-black leading-5 text-white">
              Try workspace <ArrowRight size={15} />
            </Link>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {roleCards.map(([title, copy], index) => {
              const icons = [BriefcaseBusiness, Code2, UsersRound, Brain, BadgeCheck, Languages];
              const Icon = icons[index] || BriefcaseBusiness;
              return (
                <article key={title} className="mi-role-card mi-card mi-hover-lift mi-reveal flex min-h-40 flex-col justify-between p-4">
                  <span className="mi-icon-disc">
                    <Icon size={20} />
                  </span>
                  <div>
                    <h3 className="text-lg font-black">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#6f5c4c]">{copy}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-[#ead6bd] bg-[#fffaf0] py-14 sm:py-16">
        <div className="mi-shell grid gap-7 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="mi-reveal">
            <p className="text-xs font-black uppercase text-[#bd641f]">Evidence-first guardrails</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">We are strict about hallucination risk.</h2>
            <p className="mt-3 text-sm leading-6 text-[#6f5c4c]">
              Mieru treats uncertain data as recruiter-review territory. That keeps the shortlist calm, auditable, and honest.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {antiRisk.map((item, index) => (
              <div key={item} className="mi-risk-card mi-reveal rounded-2xl border border-[#ead6bd] bg-white p-4">
                <ShieldAlert size={18} className={index % 3 === 0 ? "text-[#b42318]" : index % 3 === 1 ? "text-[#b54708]" : "text-[#067232]"} />
                <p className="mt-3 text-sm font-black">{item}</p>
                <p className="mt-1 text-xs leading-5 text-[#6f5c4c]">Flagged before it can become a hidden shortlist assumption.</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="py-14 sm:py-16">
        <div className="mi-shell">
          <div className="grid gap-7 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="mi-reveal">
              <p className="text-xs font-black uppercase text-[#bd641f]">Fewer steps. Clearer decisions.</p>
              <h2 className="mt-3 text-3xl font-black sm:text-4xl">Make shortlisting calmer.</h2>
              <p className="mt-3 text-sm leading-6 text-[#6f5c4c]">
                The point is not to replace recruiter judgment. It is to remove the repetitive evidence work before judgment begins.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {comparison.map(([title, ...steps]) => (
                <div key={title} className={`mi-timeline-card mi-reveal rounded-[28px] border p-4 ${title.startsWith("Mieru") ? "border-[#24140f] bg-[#24140f] text-white" : "border-[#ead6bd] bg-white"}`}>
                  <p className={`text-xs font-black uppercase ${title.startsWith("Mieru") ? "text-[#ffcc7a]" : "text-[#bd641f]"}`}>{title}</p>
                  <div className="mt-4 grid gap-2">
                    {steps.map((step, index) => (
                      <div key={step} className={`mi-step-row flex items-center gap-3 rounded-2xl border px-3 py-2 ${title.startsWith("Mieru") ? "border-white/10 bg-white/[.06]" : "border-[#ead6bd] bg-[#fffaf0]"}`}>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-black ${title.startsWith("Mieru") ? "bg-[#ffcc7a] text-[#24140f]" : "bg-[#24140f] text-white"}`}>{index + 1}</span>
                        <span className="text-sm font-bold">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#ead6bd] bg-[#24140f] py-14 text-white sm:py-16">
        <div className="mi-shell grid gap-8 lg:grid-cols-[minmax(0,1fr)_460px] lg:items-center">
          <div className="mi-reveal">
            <p className="text-xs font-black uppercase text-[#ffcc7a]">Join the beta</p>
            <h2 className="mt-3 text-3xl font-black sm:text-4xl">Build a shortlist desk your recruiters can trust.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#f8ead5]">
              Start with a workspace account, or leave your details and we will track interest against the Mieru backend.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-black leading-5 text-[#24140f] transition hover:bg-[#fff7e8]">
                Create account <ArrowRight size={16} />
              </Link>
              <Link href="/login" className="inline-flex min-h-11 items-center rounded-full border border-white/20 px-5 py-2 text-sm font-bold leading-5 text-white transition hover:bg-white/10">
                Log in
              </Link>
            </div>
          </div>
          <LandingInterestForm />
        </div>
      </section>
    </main>
  );
}
