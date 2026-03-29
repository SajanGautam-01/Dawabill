"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Download, Database, FileJson, FileSpreadsheet, Loader2, CheckCircle2 } from "lucide-react";
import { logger } from "@/lib/logger";

interface BackupSectionProps {
  storeId: string;
}

export default function BackupSection({ storeId }: BackupSectionProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [lastExport, setLastExport] = useState<string | null>(null);

  const downloadFile = (content: string, fileName: string, contentType: string) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
  };

  const exportToJson = async () => {
    if (!storeId) return;
    setIsExporting(true);

    try {
      // Fetch all core data for the store
      const [products, bills, billItems, accounts] = await Promise.all([
        supabase.from("products").select("*").eq("store_id", storeId),
        supabase.from("bills").select("*").eq("store_id", storeId),
        supabase.from("bill_items").select("*").eq("store_id", storeId),
        supabase.from("payment_accounts").select("*").eq("store_id", storeId),
      ]);

      const backupData = {
        exportDate: new Date().toISOString(),
        storeId,
        version: "1.0",
        data: {
          products: products.data || [],
          bills: bills.data || [],
          billItems: billItems.data || [],
          paymentAccounts: accounts.data || [],
        }
      };

      const jsonString = JSON.stringify(backupData, null, 2);
      const timestamp = new Date().toISOString().split('T')[0];
      downloadFile(jsonString, `DawaBill_Backup_${timestamp}.json`, "application/json");
      
      setLastExport(new Date().toLocaleTimeString());
      await logger.info("Manual JSON backup exported", { storeId, action: 'backup_export' });
    } catch (error: any) {
      console.error("Export failed:", error);
      await logger.error(`Backup export failed: ${error.message}`, { storeId, action: 'backup_export' });
    } finally {
      setIsExporting(false);
    }
  };

  const exportInventoryToCsv = async () => {
    if (!storeId) return;
    setIsExporting(true);

    try {
      const { data: products } = await supabase.from("products").select("name, batch_number, stock_quantity, mrp, sale_rate, expiry_date").eq("store_id", storeId);
      
      if (!products || products.length === 0) return;

      const headers = ["Product Name", "Batch", "Stock", "MRP", "Sale Rate", "Expiry"];
      const rows = products.map(p => [
        `"${p.name}"`,
        `"${p.batch_number || '-'}"`,
        p.stock_quantity,
        p.mrp,
        p.sale_rate,
        p.expiry_date || '-'
      ]);

      const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
      const timestamp = new Date().toISOString().split('T')[0];
      downloadFile(csvContent, `Inventory_${timestamp}.csv`, "text/csv");
      
      await logger.info("Inventory CSV exported", { storeId, action: 'inventory_export' });
    } catch (error: any) {
      console.error("CSV Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Card className="rounded-3xl shadow-lg border border-slate-100 bg-white hover:shadow-xl transition-all duration-200 mt-8">
      <CardHeader className="p-8 pb-4 border-b border-slate-100 bg-slate-50/50 rounded-t-3xl">
        <CardTitle className="text-2xl font-black flex items-center gap-3 text-slate-800">
          <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner">
             <Database size={20} strokeWidth={2.5}/> 
          </div>
          Data Backup & Portability
        </CardTitle>
        <CardDescription className="text-base font-medium mt-1">Download a physical copy of your store data for emergency recovery or auditing.</CardDescription>
      </CardHeader>
      <CardContent className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 border-2 border-slate-100 rounded-2xl bg-slate-50/30 flex flex-col justify-between space-y-4">
            <div>
              <h4 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <FileJson className="text-blue-500" size={20} /> Full JSON Snapshot
              </h4>
              <p className="text-sm text-slate-500 mt-2">
                Complete database backup including Bills, Products, and Settings. Best for emergency restoration.
              </p>
            </div>
            <Button 
              onClick={exportToJson} 
              disabled={isExporting}
              className="w-full h-12 rounded-xl font-bold bg-white border-2 border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-200 shadow-sm transition-all flex items-center gap-2"
              variant="outline"
            >
              {isExporting ? <Loader2 className="animate-spin h-5 w-5" /> : <Download size={18} />}
              Export as JSON
            </Button>
          </div>

          <div className="p-6 border-2 border-slate-100 rounded-2xl bg-slate-50/30 flex flex-col justify-between space-y-4">
            <div>
              <h4 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <FileSpreadsheet className="text-emerald-500" size={20} /> Inventory CSV
              </h4>
              <p className="text-sm text-slate-500 mt-2">
                Spreadsheet-ready list of your current stock, rates, and expiry dates. Ideal for accounting.
              </p>
            </div>
            <Button 
              onClick={exportInventoryToCsv} 
              disabled={isExporting}
              className="w-full h-12 rounded-xl font-bold bg-white border-2 border-emerald-100 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 shadow-sm transition-all flex items-center gap-2"
              variant="outline"
            >
              {isExporting ? <Loader2 className="animate-spin h-5 w-5" /> : <Download size={18} />}
              Export CSV
            </Button>
          </div>
        </div>

        {lastExport && (
          <div className="mt-6 flex items-center gap-2 text-emerald-600 text-sm font-bold bg-emerald-50 p-3 rounded-xl border border-emerald-100 animate-in fade-in slide-in-from-bottom-2">
            <CheckCircle2 size={16} /> Last export completed at {lastExport}
          </div>
        )}

        <div className="mt-8 p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800 text-xs font-medium leading-relaxed">
          <p className="flex items-center gap-2 font-bold mb-1 uppercase tracking-tight">⚠️ Professional Tip</p>
          Supabase performs automated daily backups. However, it is highly recommended to perform a manual JSON export before making large inventory changes or shelf-life updates.
        </div>
      </CardContent>
    </Card>
  );
}
