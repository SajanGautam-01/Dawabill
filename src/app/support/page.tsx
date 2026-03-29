"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { LifeBuoy, Send, Loader2, MessageSquare, Clock } from "lucide-react";

type Ticket = {
  id: string;
  subject: string;
  description: string;
  status: string;
  created_at: string;
};

export default function SupportPage() {
  const { storeId } = useStore();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [dataFetched, setDataFetched] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (storeId && !dataFetched) {
      fetchTickets();
    }
  }, [storeId, dataFetched]);

  const fetchTickets = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('support_tickets')
      .select('id, user_id, subject, description, issue_type, priority, status, created_at, closed_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) setTickets(data);
    setDataFetched(true);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) return setError("Authentication Error");
    
    setIsSubmitting(true);
    setError(null);

    const { error: insertError } = await supabase.from('support_tickets').insert([{
      store_id: storeId,
      subject,
      description,
      status: 'open'
    }]);

    setIsSubmitting(false);

    if (insertError) {
      setError("Failed to submit ticket.");
    } else {
      setSubject("");
      setDescription("");
      fetchTickets();
    }
  };

  return (
    <div className="space-y-8 pb-20 max-w-6xl mx-auto px-4 sm:px-6">
      <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 mb-8">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">Help & Support</h1>
        <p className="text-base sm:text-lg text-slate-500 mt-2 font-medium">Submit support tickets or contact us directly via WhatsApp.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Create Ticket Form */}
        <div className="lg:col-span-5">
          <Card className="rounded-3xl shadow-xl border border-blue-100 bg-gradient-to-br from-white to-blue-50/50 sticky top-24 overflow-hidden">
            <CardHeader className="bg-blue-50/80 border-b border-blue-100 p-8 rounded-t-3xl backdrop-blur-md">
              <CardTitle className="text-2xl font-black flex items-center gap-3 text-blue-900">
                <div className="p-3 bg-blue-100 text-blue-600 rounded-xl shadow-inner"><LifeBuoy size={24} strokeWidth={2.5}/></div> Create Ticket
              </CardTitle>
              <CardDescription className="text-base font-medium mt-2 text-blue-800/70">
                Describe your issue and our team will get back to you within 24 hours.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && <div className="p-4 bg-red-50/80 backdrop-blur-sm border border-red-100 text-red-600 font-bold rounded-2xl text-sm shadow-inner">{error}</div>}
                
                <div className="space-y-2">
                  <Label htmlFor="subject" className="text-slate-700 font-bold text-sm">Issue Subject <span className="text-red-500">*</span></Label>
                  <Input 
                    id="subject" 
                    placeholder="e.g. Printer not working" 
                    required 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="h-14 rounded-2xl border-2 border-slate-200 focus-visible:ring-4 focus-visible:ring-blue-500/20 text-base font-medium bg-white"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-slate-700 font-bold text-sm">Detailed Description <span className="text-red-500">*</span></Label>
                  <textarea 
                    id="description" 
                    required 
                    placeholder="Provide as much detail as possible..."
                    className="w-full min-h-[140px] p-4 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-medium text-base resize-y bg-white"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full h-14 rounded-2xl text-lg font-bold shadow-xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 transition-all text-white" disabled={isSubmitting || !subject || !description}>
                   {isSubmitting ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <Send className="mr-3 h-5 w-5" strokeWidth={2.5} />}
                   {isSubmitting ? "Submitting..." : "Submit Ticket"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Previous Tickets List */}
        <div className="lg:col-span-7 space-y-6 lg:pl-4">
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <div className="p-2.5 bg-slate-100 text-slate-500 rounded-xl shadow-inner"><Clock size={22} strokeWidth={2.5}/></div> Previous Tickets
          </h2>
          
          <div className="space-y-5">
            {loading ? (
              <div className="h-48 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-12 border-2 border-dashed border-slate-200 rounded-3xl text-center flex flex-col items-center bg-slate-50/50">
                <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 rounded-2xl flex items-center justify-center mb-4">
                  <MessageSquare size={28} className="text-slate-400" />
                </div>
                <p className="text-xl font-bold text-slate-700">No active tickets.</p>
                <p className="text-base font-medium text-slate-500 mt-2">If you need help, submit a ticket on the left.</p>
              </div>
            ) : (
               tickets.map(ticket => (
                 <Card key={ticket.id} className="rounded-3xl shadow-sm border-2 border-slate-100 hover:border-blue-200 hover:shadow-md transition-all cursor-default bg-white">
                   <CardContent className="p-6">
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                       <h3 className="font-bold text-lg text-slate-900 leading-tight">{ticket.subject}</h3>
                       <span className={`text-xs px-3 py-1.5 rounded-lg font-black uppercase tracking-widest shadow-inner shrink-0 ${
                         ticket.status === 'open' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 
                         ticket.status === 'resolved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 
                         'bg-slate-100 text-slate-800 border border-slate-200'
                       }`}>
                         {ticket.status}
                       </span>
                     </div>
                     <p className="text-base text-slate-600 font-medium line-clamp-2 leading-relaxed mb-4">{ticket.description}</p>
                     <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                       <p className="text-sm text-slate-400 font-bold font-mono bg-slate-50 px-3 py-1 rounded-md">#{ticket.id.split('-')[0]}</p>
                       <p className="text-sm font-bold text-slate-500">{new Date(ticket.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                     </div>
                   </CardContent>
                 </Card>
               ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
