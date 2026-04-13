import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/toast";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NextHire — AI-Powered Candidate Screening",
  description:
    "Screen smarter. Hire with precision. NextHire scores every candidate against a structured rubric — iterative, transparent, and bias-free.",
  keywords: ["ATS", "AI screening", "hiring", "resume screening", "structured evaluation"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {/* Atmospheric orb background — purely visual */}
        <div
          className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
          aria-hidden
        >
          {/* Primary blue orb — top-left, slowly drifts */}
          <div
            className="absolute -top-[20%] -left-[8%] w-[55%] h-[55%] rounded-full nh-orb-drift"
            style={{
              background: "radial-gradient(circle, rgba(79,110,247,0.20) 0%, transparent 68%)",
              filter: "blur(90px)",
            }}
          />
          {/* Deep indigo — bottom-right */}
          <div
            className="absolute -bottom-[18%] -right-[8%] w-[55%] h-[55%] rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(99,62,235,0.16) 0%, transparent 70%)",
              filter: "blur(100px)",
              animation: "nh-orb-drift 22s ease-in-out 4s infinite reverse",
            }}
          />
          {/* Cyan mid-accent */}
          <div
            className="absolute top-[38%] left-[38%] w-[32%] h-[32%] rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 70%)",
              filter: "blur(110px)",
              animation: "nh-orb-drift 28s ease-in-out 8s infinite",
            }}
          />
          {/* Violet top-right */}
          <div
            className="absolute -top-[8%] right-[12%] w-[28%] h-[28%] rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)",
              filter: "blur(80px)",
              animation: "nh-orb-drift 20s ease-in-out 12s infinite reverse",
            }}
          />
        </div>

        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
