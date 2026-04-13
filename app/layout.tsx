import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NextHire — AI-Powered Hiring Intelligence",
  description: "Screen smarter. Hire faster. NextHire uses Google Gemini to shortlist candidates with iterative criteria refinement and field-level scoring.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {/* ── Atmospheric background orbs ── */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden>
          {/* Top-left blue orb */}
          <div
            className="absolute -top-[20%] -left-[10%] w-[55%] h-[55%] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(37,99,235,0.18) 0%, transparent 70%)", filter: "blur(60px)" }}
          />
          {/* Bottom-right indigo orb */}
          <div
            className="absolute -bottom-[20%] -right-[10%] w-[55%] h-[55%] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(79,70,229,0.14) 0%, transparent 70%)", filter: "blur(60px)" }}
          />
          {/* Centre cyan orb */}
          <div
            className="absolute top-[35%] left-[45%] w-[35%] h-[35%] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)", filter: "blur(80px)" }}
          />
        </div>

        {children}
      </body>
    </html>
  );
}
