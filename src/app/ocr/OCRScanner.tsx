import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Camera, Image as ImageIcon, Check, Loader2, RefreshCw, AlertCircle, CloudUpload } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/hooks/useStore";
import Link from "next/link";

import { useSubscriptionGuard } from "@/hooks/useSubscriptionGuard";
import { Lock } from "lucide-react";

export default function OCRScanner() {
  const { storeId } = useStore();
  const { canUseOCR, loading: subLoading } = useSubscriptionGuard();
  
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiSuccess, setAiSuccess] = useState(false);
  
  const [parsedData, setParsedData] = useState({
    name: "",
    batch: "",
    mrp: "",
    qty: ""
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setExtractedText("");
        setShowPreview(false);
        setAiSuccess(false);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (showPreview && extractedText.trim().length > 0) {
      setIsAiParsing(true);
      setAiSuccess(false);
      
      const timer = setTimeout(async () => {
        try {
          const res = await fetch('/api/ocr-parse', {
            method: 'POST',
            body: JSON.stringify({ text: extractedText })
          });
          
          if (!res.ok) return;

          const aiData = await res.json();
          setParsedData(prev => ({
            ...prev,
            name: aiData.name || prev.name,
            mrp: aiData.mrp || prev.mrp,
            batch: aiData.batch || prev.batch
          }));
          setAiSuccess(true);
        } catch (e) {
          console.error("AI Parsing failed", e);
        } finally {
          setIsAiParsing(false);
        }
      }, 700);
      
      return () => clearTimeout(timer);
    }
  }, [extractedText, showPreview]);

  const processImage = async () => {
    if (!image) return;
    setIsProcessing(true);
    
    try {
      const Tesseract = (await import('tesseract.js')).default;
      
      const result = await Tesseract.recognize(
        image,
        'eng',
        { logger: (m: any) => console.log(m) }
      );
      
      const text = result.data.text;
      const confidence = result.data.confidence;
      setExtractedText(text);

      if (confidence < 60 || text.trim().length === 0) {
        setShowPreview(true);
        return;
      }
      
      const lines = text.split('\n');
      const mrpLine = lines.find((l: string) => l.toUpperCase().includes('MRP') || l.includes('Rs') || l.includes('₹'));
      const batchLine = lines.find((l: string) => l.toUpperCase().includes('BATCH') || l.toUpperCase().includes('LOT'));
      
      setParsedData({
        name: lines[0] || "",
        batch: batchLine ? batchLine.replace(/[^0-9A-Z-]/gi, '').slice(0, 10) : "",
        mrp: mrpLine ? mrpLine.replace(/[^0-9.]/g, '') : "",
        qty: "1"
      });
      
      setShowPreview(true);
    } catch (err) {
      console.error("OCR Error", err);
    } finally {
      setIsProcessing(false);
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
        purchase_rate: 0,
        sale_rate: parseFloat(parsedData.mrp) || 0,
      }]);

      if (!error) {
        alert("Successfully saved to inventory!");
        setImage(null);
        setShowPreview(false);
      } else {
        alert("Error saving: " + error.message);
      }
    } catch (e) {
      console.error("Save to inventory failed", e);
      alert("Error saving. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (subLoading) {
    return <div className="h-40 flex items-center justify-center">Loading scanner access...</div>;
  }

  if (!canUseOCR) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mb-6 shadow-inner border border-blue-100">
           <Lock size={36} strokeWidth={2.5}/>
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Professional Feature</h2>
        <p className="text-slate-500 mt-4 mb-8 max-w-md text-base mx-auto font-medium text-balance">
          AI OCR Scanning is exclusive to the <strong>Professional</strong> and <strong>Lifetime</strong> plans. 
          Upgrade now to scan batch numbers and prices instantly.
        </p>
        <Link 
          href="/settings/subscription" 
          className="inline-flex items-center justify-center rounded-2xl text-base transition-all bg-blue-600 hover:bg-blue-700 text-white font-bold h-14 px-8 shadow-lg shadow-blue-500/20"
        >
          Upgrade to Professional
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-w-0 w-full max-w-7xl space-y-8 px-4 pb-20 sm:px-6">
      <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-sm border border-slate-100 mb-8 text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">AI Receipt Scanner</h1>
        <p className="text-base sm:text-lg text-slate-500 mt-2 font-medium">Extract text from bills and medicine strips instantly using OCR.</p>
      </div>

      <div className={`grid min-w-0 grid-cols-1 gap-8 transition-all duration-200 ${showPreview ? 'lg:grid-cols-2' : 'mx-auto max-w-2xl'}`}>
        {/* Left Column: Image Upload & Preview */}
        <Card className="min-w-0 rounded-3xl shadow-lg border border-slate-100 bg-white hover:shadow-xl transition-all duration-200">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-2xl font-black text-slate-800">Upload Media</CardTitle>
            <CardDescription className="text-base font-medium mt-1">Take a photo or upload an image.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-6">
            
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleImageUpload}
            />

            {!image && (
              <div 
                role="button"
                tabIndex={0}
                className="border-2 border-dashed border-slate-200 hover:border-blue-400 focus:border-blue-400 hover:bg-blue-50/50 focus:bg-blue-50/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/30 transition-all duration-200 rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer min-h-[300px] group" 
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <div className="w-20 h-20 bg-blue-50 group-hover:bg-blue-100 text-blue-500 rounded-full flex items-center justify-center mb-6 shadow-inner transition-colors">
                  <CloudUpload size={36} strokeWidth={2.5} />
               </div>
                <p className="text-xl font-black text-slate-800 mb-2">Click to upload image</p>
                <p className="text-sm font-medium text-slate-500">Supports PNG, JPG, or direct camera capture</p>
              </div>
            )}

            {!image && (
               <div className="flex gap-4">
                 <Button 
                   variant="outline" 
                   className="w-full h-14 rounded-2xl font-bold shadow-sm border-2 text-slate-700 hover:bg-slate-50 hover:-translate-y-0.5 transition-all flex items-center gap-2 text-base"
                   onClick={() => fileInputRef.current?.click()}
                 >
                   <Camera size={20} /> Capture Photo
                 </Button>
               </div>
            )}

            {image && (
              <div className="space-y-6 animate-in fade-in duration-200">
                <div className="relative flex min-h-[300px] items-center justify-center overflow-auto rounded-3xl border-2 border-slate-100 bg-slate-50 p-4 shadow-inner">
                  <img src={image} alt="Uploaded preview" className="max-h-[min(400px,60vh)] w-auto max-w-full rounded-2xl object-contain shadow-sm [image-orientation:from-image]" />
                </div>
                {!showPreview && (
                  <Button 
                    className="w-full h-16 rounded-3xl text-lg font-bold shadow-xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 transition-all flex items-center justify-center" 
                    onClick={processImage}
                    disabled={isProcessing || isAiParsing}
                  >
                    {isProcessing ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <ScanText size={24} className="mr-3" />}
                    {isProcessing ? "Extracting Text..." : "Run AI Extraction"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Editable Preview */}
        {showPreview && (
          <Card className="min-w-0 rounded-3xl shadow-2xl border border-blue-200 bg-white/95 backdrop-blur-xl animate-in slide-in-from-right-8 duration-200 flex flex-col">
            <CardHeader className="bg-blue-50/80 border-b border-blue-100 p-8 rounded-t-3xl backdrop-blur-md">
              <CardTitle className="text-2xl font-black flex items-center justify-between text-blue-900">
                <div className="flex items-center gap-3">
                  <span>Verification</span>
                  {isAiParsing ? (
                     <span className="text-xs font-bold bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 animate-pulse">
                       <Loader2 size={14} className="animate-spin"/> AI Analysing...
                     </span>
                  ) : aiSuccess ? (
                     <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm border border-emerald-200">
                       ✨ AI Enhanced
                     </span>
                  ) : null}
                </div>
                <span className="text-xs font-bold bg-amber-100 text-amber-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-inner">
                  <AlertCircle size={14} strokeWidth={2.5} /> Review & Edit
                </span>
              </CardTitle>
              <CardDescription className="text-blue-800/70 font-medium mt-2 text-base">
                OCR might contain errors. Please review and edit before saving.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              
              <div className="space-y-3">
                <Label htmlFor="ocrText" className="text-base font-bold text-slate-800">Raw Extracted Text</Label>
                <textarea 
                  id="ocrText"
                  className="w-full h-32 p-4 text-sm border-2 border-slate-200 rounded-2xl bg-slate-50 focus:ring-4 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-slate-700 shadow-inner"
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                />
              </div>

              <div className="pt-6 border-t-2 border-dashed border-slate-200 space-y-5">
                <Label className="text-base font-bold text-slate-800 block">Parsed Inventory Data</Label>
                <div className="grid min-w-0 grid-cols-2 gap-5">
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="p_name" className="text-slate-600 font-semibold">Product Name</Label>
                    <Input id="p_name" className="h-14 rounded-2xl border-2 border-slate-200 focus-visible:ring-4 focus-visible:ring-blue-500/20 text-base font-medium" value={parsedData.name} onChange={(e) => setParsedData({...parsedData, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p_mrp" className="text-slate-600 font-semibold">MRP</Label>
                    <Input id="p_mrp" className="h-14 rounded-2xl border-2 border-slate-200 focus-visible:ring-4 focus-visible:ring-blue-500/20 text-base font-medium text-blue-700" value={parsedData.mrp} onChange={(e) => setParsedData({...parsedData, mrp: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="p_batch" className="text-slate-600 font-semibold">Batch No.</Label>
                    <Input id="p_batch" className="h-14 rounded-2xl border-2 border-slate-200 focus-visible:ring-4 focus-visible:ring-blue-500/20 text-base font-medium" value={parsedData.batch} onChange={(e) => setParsedData({...parsedData, batch: e.target.value})} />
                  </div>
                </div>
              </div>

            </CardContent>
            <CardFooter className="bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row gap-4 p-8 rounded-b-3xl mt-auto">
              <Button
                variant="outline"
                className="w-full sm:w-1/3 h-14 rounded-2xl font-bold border-2 border-slate-200 hover:bg-slate-50 hover:-translate-y-0.5 transition-all text-slate-700"
                onClick={() => setShowPreview(false)}
                disabled={isProcessing || isAiParsing}
              >
                <RefreshCw size={18} className="mr-2" /> Discard
              </Button>
              <Button
                className="w-full sm:w-2/3 h-14 rounded-2xl text-base font-bold shadow-xl shadow-blue-500/20 bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 text-white transition-all"
                onClick={handleSaveToInventory}
                disabled={isProcessing || isAiParsing}
              >
                {(isProcessing || isAiParsing) ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check size={20} strokeWidth={3} className="mr-2" />}
                {isProcessing ? "Saving..." : isAiParsing ? "Please wait..." : "Confirm & Save"}
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}

function ScanText({ className, size }: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
      <path d="M6 10c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2" />
      <path d="M6 14c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2" />
    </svg>
  );
}
