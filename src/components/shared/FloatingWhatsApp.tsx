"use client";

import { MessageCircle } from "lucide-react";

export default function FloatingWhatsApp() {
  // Replace with the actual support number
  const adminWhatsApp = "919876543210"; 
  const message = encodeURIComponent("Hello DawaBill Support, I need help with my store.");

  return (
    <a 
      href={`https://wa.me/${adminWhatsApp}?text=${message}`} 
      target="_blank" 
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 md:bottom-8 md:right-8 bg-[#25D366] text-white p-4 rounded-full shadow-2xl hover:bg-[#128C7E] transition-all hover:scale-110 z-50 flex items-center justify-center group"
      aria-label="Chat with us on WhatsApp"
    >
      <MessageCircle size={32} />
      {/* Tooltip visible on hover */}
      <span className="absolute right-full mr-4 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
        Need Help? Chat with us
        {/* Tooltip arrow */}
        <span className="absolute left-full top-1/2 -translate-y-1/2 border-4 border-transparent border-l-slate-900"></span>
      </span>
    </a>
  );
}
