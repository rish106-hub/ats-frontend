"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ open, onClose, title, children, maxWidth = "520px" }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9000] flex items-center justify-center p-4 nh-backdrop"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="nh-overlay nh-modal-enter w-full shadow-2xl"
        style={{
          maxWidth,
          boxShadow: "0 25px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(79,110,247,0.18)",
        }}
      >
        {/* Header */}
        {title && (
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: "rgba(79,110,247,0.12)" }}
          >
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#3a5080] hover:text-[#8899b8] transition-colors"
              style={{ background: "rgba(79,110,247,0.06)", border: "1px solid rgba(79,110,247,0.14)" }}
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
