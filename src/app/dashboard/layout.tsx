import FloatingWhatsApp from "@/components/shared/FloatingWhatsApp";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-[#f8fafc] md:flex-row">
      <main className="relative min-h-0 w-full min-w-0 flex-1 px-4 py-6 md:p-8">
        {/* Dynamic subtle background similar to auth pages */}
        <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-blue-50/50 to-transparent pointer-events-none z-0"></div>
        <div className="relative z-10 w-full max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <FloatingWhatsApp />
    </div>
  );
}
