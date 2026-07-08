import { Radar } from "lucide-react";

export function MieruLogo({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-9 w-9 items-center justify-center rounded-full shadow-sm ${inverse ? "bg-[#fff7e8] text-[#24140f]" : "bg-[#24140f] text-[#fff7e8]"}`}>
        <Radar size={17} strokeWidth={2.4} />
      </span>
      {!compact && (
        <span>
          <span className={`block text-sm font-black ${inverse ? "text-white" : "text-[#24140f]"}`}>Mieru</span>
          <span className={`block text-[11px] ${inverse ? "text-[#f7d8ad]" : "text-[#7d6a58]"}`}>Evidence-visible shortlisting</span>
        </span>
      )}
    </div>
  );
}
