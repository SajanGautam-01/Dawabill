"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// Ensure the massive OCR UI structure and dependencies are completely code-split from the Next.js bundle footprint
const OCRScanner = dynamic(() => import("./OCRScanner"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center space-y-4 flex-col bg-slate-50/50">
      <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      <p className="text-slate-500 font-medium animate-pulse text-sm uppercase tracking-widest">Loading Scanner Module...</p>
    </div>
  ),
});

export default function OCRPage() {
  return <OCRScanner />;
}
