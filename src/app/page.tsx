import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ArrowRight, Pill, ShieldCheck, Zap, ReceiptIndianRupee, Package, QrCode } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-blue-100">
      {/* Header */}
      <header className="px-6 h-16 flex items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Pill className="text-white h-5 w-5" />
          </div>
          DawaBill SaaS
        </div>
        <div className="flex gap-4">
          <Link href="/auth/login">
            <Button variant="ghost" className="hidden sm:inline-flex font-medium">Log in</Button>
          </Link>
          <Link href="/auth/signup">
            <Button className="font-semibold shadow-md shadow-blue-500/20">Get Started</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 py-24 sm:py-32 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-slate-50 to-slate-50">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-sm font-semibold mb-8 ring-1 ring-inset ring-emerald-500/20">
          <ShieldCheck size={16} /> Data Secured via RLS Multi-Tenancy
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight max-w-4xl leading-[1.1]">
          Smart Billing & Inventory for <br className="hidden md:block"/>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Medical Stores</span>
        </h1>
        
        <p className="mt-6 text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
          Supercharge your pharmacy with blazing fast GST billing, dynamic UPI QR payments, automated stock tracking, and intelligent OCR scanning. 
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto px-4">
          <Link href="/auth/signup" className="w-full sm:w-auto">
             <Button size="lg" className="w-full text-lg h-14 px-8 rounded-xl shadow-xl shadow-blue-500/20 group bg-blue-600 hover:bg-blue-700">
               Start managing your store <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" />
             </Button>
          </Link>
          <Link href="/auth/login" className="w-full sm:w-auto">
             <Button variant="outline" size="lg" className="w-full text-lg h-14 px-8 rounded-xl bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700">
               Store Login
             </Button>
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-white py-24 border-t border-slate-100 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900">Built for Indian Pharmacies</h2>
            <p className="mt-4 text-slate-500 max-w-2xl mx-auto">Everything you need to run your store efficiently, from taking payments to managing expiry dates.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-6">
                <ReceiptIndianRupee size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Fast Billing & GST</h3>
              <p className="text-slate-600 leading-relaxed">Keyboard-friendly checkout interface with automatic GST calculations designed for heavy foot traffic.</p>
            </div>
            
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6">
                <Package size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Smart Inventory</h3>
              <p className="text-slate-600 leading-relaxed">Track batches, get alerted before medicines expire, and auto-manage stock reductions during billing.</p>
            </div>
            
            <div className="p-8 rounded-2xl bg-slate-50 border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-6">
                <QrCode size={24} />
              </div>
              <h3 className="text-xl font-bold text-slate-800 mb-2">Dynamic UPI Payments</h3>
              <p className="text-slate-600 leading-relaxed">Eliminate wrong amount errors. Add multiple UPI IDs and generate dynamic QR codes instantly on cash counters.</p>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
