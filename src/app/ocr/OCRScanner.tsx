"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { 
  Camera, 
  Check, 
  Loader2, 
  RefreshCw, 
  CloudUpload, 
  ArrowRight,
  ShieldCheck,
  Package,
  FileText
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import { useToast } from "@/components/ui/Toast";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";

// ─── Module Singleton Worker ─────────────────────────────────────────
let globalWorker: any = null;

// ─── Medical-Grade Scan Steps ───────────────────────────────────────
const SCAN_STEPS = [
  { id: 1, label: "Cleaning Image...", description: "Optimizing contrast for better accuracy" },
  { id: 2, label: "Extracting Text...", description: "Identifying medicine names and batches" },
  { id: 3, label: "Reading Prices...", description: "Locating MRP and quantity details" },
  { id: 4, label: "Finishing...", description: "Finalizing scan details" },
];

async function preprocessImage(base64Str: string, maxWidth = 1200): Promise<{ processed: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64Str;
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return reject('Canvas context fail');
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = data[i + 1] = data[i + 2] = l;
      }
      ctx.putImageData(imageData, 0, 0);
      resolve({
        processed: canvas.toDataURL('image/jpeg', 0.85),
      });
    };
    img.onerror = reject;
  });
}

export default function OCRScanner() {
  const [mounted, setMounted] = useState(false);
  const { storeId } = useStore();
  const { loading: subLoading } = useSubscriptionGuard();
  const { toast } = useToast();
  
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanStep, setScanStep] = useState(0); 
  const [extractedText, setExtractedText] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showFlash, setShowFlash] = useState(false);

  const [parsedData, setParsedData] = useState({
    name: "",
    batch: "",
    mrp: "",
    qty: "1"
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessingRef = useRef(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    return () => {
      if (globalWorker) {
        globalWorker.terminate();
        globalWorker = null;
      }
    };
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setExtractedText("");
        setScanStep(0);
        setShowPreview(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async () => {
    if (!image || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsProcessing(true);
    setScanStep(1);
    
    try {
      setScanStep(2);
      const { processed: resizedImage } = await preprocessImage(image);

      setScanStep(3);
      const { createWorker } = (await import('tesseract.js')).default;
      if (!globalWorker) {
        globalWorker = await createWorker('eng', 1);
        await globalWorker.setParameters({ 
          tessedit_pageseg_mode: '3',
          tessjs_create_hocr: '0',
          tessjs_create_tsv: '0'
        });
      }

      setScanStep(4);
      const result: any = await globalWorker.recognize(resizedImage);
      
      setShowFlash(true);
      setTimeout(() => setShowFlash(false), 300);
      
      setExtractedText(result.data.text);
      setShowPreview(true);
      toast("Scan Complete", "success");
      
    } catch (err: any) {
      console.error("OCR Failure Recovery:", err);
      toast("Something went wrong with the scan. Please try again.", "error");
    } finally {
      setIsProcessing(false);
      isProcessingRef.current = false;
      setScanStep(0);
    }
  };

  const handleSaveToInventory = async () => {
    if (!storeId) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase.from('products').insert([{
        store_id: storeId,
        name: parsedData.name || "Unknown Product",
        batch_number: parsedData.batch || null,
        mrp: parseFloat(parsedData.mrp) || 0,
        stock_quantity: parseInt(parsedData.qty) || 1,
        sale_rate: parseFloat(parsedData.mrp) || 0,
      }]);
      if (!error) {
        setImage(null);
        setShowPreview(false);
        toast("Medicine added to stock successfully", "success");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  if (!mounted || subLoading) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-8 md:space-y-10 pb-20">
      
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center text-center space-y-3 px-4">
        <Badge variant="outline" className="px-4 py-1.5 border-primary/20 text-primary font-bold uppercase tracking-widest text-[9px] bg-primary/5">
           Smart Scanner
        </Badge>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
          Bill <span className="text-primary italic text-2xl md:text-3xl">Auto-Scan</span>
        </h1>
        <p className="text-slate-500 font-medium max-w-sm md:max-w-lg text-sm md:text-base">
          Scan bills or medicine strips to extract names, batches, and prices automatically.
        </p>
      </div>

      <div className={cn(
        "grid gap-6 md:gap-10 transition-all duration-500 px-4",
        showPreview ? "lg:grid-cols-2" : "max-w-2xl mx-auto"
      )}>
        
        {/* STEP 1: SCANNER ────────────────────────────────────────────────── */}
        <Card className="border-slate-200 shadow-sm rounded-[2rem] overflow-hidden bg-white">
          <CardHeader className="p-6 md:p-8 border-b border-slate-50 bg-slate-50/50">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-sm border border-primary/10">
                   <FileText size={20} />
                </div>
                <div>
                   <CardTitle className="text-lg md:text-xl font-bold">1. Capture Bill</CardTitle>
                   <CardDescription className="text-[10px] md:text-xs font-medium">Select a clear photo</CardDescription>
                </div>
             </div>
          </CardHeader>
          
          <CardContent className="p-5 md:p-8 space-y-6 md:space-y-8">
            <input type="file" accept="image/*" capture="environment" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />

            {!image ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="group border-2 border-dashed border-slate-100 hover:border-primary/40 bg-slate-50/50 hover:bg-white rounded-[2rem] p-8 md:p-12 transition-all cursor-pointer flex flex-col items-center justify-center text-center min-h-[280px] shadow-inner"
              >
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform shadow-sm">
                  <CloudUpload size={28} className="text-slate-400 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-base md:text-lg font-bold text-slate-900 mb-1">Upload Bill Image</h3>
                <p className="text-xs md:text-sm text-slate-500 font-medium mb-6">Camera or Photo Library</p>
                <Button className="h-10 px-8 rounded-xl font-bold gap-2 shadow-sm text-xs md:text-sm">
                   Open Scanner
                </Button>
              </div>
            ) : (
              <div className="space-y-6 md:space-y-8">
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 shadow-xl">
                  <img src={image} className="w-full h-full object-contain" />
                  
                  <AnimatePresence>
                    {showFlash && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-white z-20"
                      />
                    )}
                  </AnimatePresence>

                  <div className="absolute top-4 right-4">
                      <button onClick={() => setImage(null)} className="p-2.5 bg-white/90 backdrop-blur-sm shadow-xl text-red-500 rounded-xl hover:bg-red-50 transition-all border border-slate-200 active:scale-90">
                        <RefreshCw size={16} />
                      </button>
                  </div>
                </div>

                {!showPreview && (
                  <div className="space-y-6 md:space-y-8">
                    <Button 
                      className="w-full h-14 md:h-16 rounded-2xl font-bold text-base md:text-lg gap-3 shadow-md transition-all active:scale-95"
                      onClick={processImage}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <div className="flex items-center gap-3">
                           <Loader2 className="animate-spin h-5 w-5" />
                           <span>Analyzing...</span>
                        </div>
                      ) : (
                        <>
                           <span>Initialize Smart Scan</span>
                           <ArrowRight size={20} />
                        </>
                      )}
                    </Button>
                    
                    <div className="grid grid-cols-1 gap-3">
                       {SCAN_STEPS.map((s) => (
                         <div key={s.id} className={cn(
                           "flex items-center gap-4 p-3 rounded-2xl border transition-all",
                           scanStep === s.id ? "bg-primary/5 border-primary/20 shadow-sm" : "bg-white border-transparent opacity-40"
                         )}>
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center border font-bold text-[10px]",
                              scanStep === s.id ? "border-primary bg-primary text-white" : "border-slate-200 bg-slate-50 text-slate-400"
                            )}>
                               {scanStep > s.id ? <Check size={14} /> : s.id}
                            </div>
                            <div className="flex-1">
                               <p className="text-[11px] font-bold text-slate-900">{s.label}</p>
                               <p className="text-[9px] font-medium text-slate-400">{s.description}</p>
                            </div>
                            {scanStep === s.id && <Loader2 className="h-4 w-4 text-primary animate-spin" />}
                         </div>
                       ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* STEP 2: RESULTS ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {showPreview && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="h-full"
            >
              <Card className="border-teal-100 shadow-2xl rounded-[2rem] overflow-hidden bg-white h-full flex flex-col">
                <CardHeader className="p-6 md:p-8 border-b border-teal-50 bg-teal-50/40">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 border border-emerald-500/10">
                         <ShieldCheck size={20} />
                      </div>
                      <div>
                         <CardTitle className="text-lg md:text-xl font-bold">2. Verification</CardTitle>
                         <CardDescription className="text-[10px] md:text-xs font-medium">Verify extracted data</CardDescription>
                      </div>
                   </div>
                </CardHeader>

                <CardContent className="p-6 md:p-8 flex-1 space-y-6 md:space-y-8">
                   <div className="space-y-6">
                      <div className="space-y-2.5">
                         <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Medicine Name</Label>
                         <div className="relative group">
                           <Input className="h-12 md:h-13 rounded-xl border-slate-200 font-bold text-base md:text-lg focus:border-primary pl-11 bg-slate-50/30" value={parsedData.name} onChange={e => setParsedData({ ...parsedData, name: e.target.value })} />
                           <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                         </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                         <div className="space-y-2.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Batch ID</Label>
                            <Input className="h-12 md:h-13 rounded-xl border-slate-200 font-bold tracking-wider bg-slate-50/30 px-5" value={parsedData.batch} onChange={e => setParsedData({ ...parsedData, batch: e.target.value })} />
                         </div>
                         <div className="space-y-2.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-1">Price (₹)</Label>
                            <Input className="h-12 md:h-13 rounded-xl border-emerald-500/20 bg-emerald-50/30 font-bold text-base md:text-lg text-emerald-700 px-5" value={parsedData.mrp} onChange={e => setParsedData({ ...parsedData, mrp: e.target.value })} />
                         </div>
                      </div>
                   </div>

                   <div className="p-4 md:p-5 bg-teal-50/50 rounded-2xl border border-teal-100 flex items-start gap-4">
                      <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-600 shrink-0 mt-0.5">
                         <FileText size={16} />
                      </div>
                      <div>
                         <p className="text-[11px] font-bold text-slate-900 mb-1">Accuracy Check</p>
                         <p className="text-[10px] font-medium text-slate-500 leading-relaxed">Please ensure the above values match your physical bill before adding to stock.</p>
                      </div>
                   </div>
                </CardContent>

                <CardFooter className="p-6 md:p-8 border-t border-slate-50 bg-slate-50/30 flex gap-4">
                   <Button variant="ghost" className="flex-1 h-12 rounded-xl text-slate-500 hover:bg-slate-100 font-bold text-sm" onClick={() => setShowPreview(false)}>
                      Discard
                   </Button>
                   <Button className="flex-[2] h-12 rounded-xl font-bold text-sm gap-2 active:scale-95 transition-all shadow-md hover:shadow-lg" onClick={handleSaveToInventory}>
                      <span>Add to Inventory</span>
                      <ArrowRight size={18} />
                   </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
