import React from "react";
import { cn } from "@/lib/utils";

// Using forwardRef as required by react-to-print
export const InvoiceTemplate = React.forwardRef<HTMLDivElement, any>(
  (props, ref) => {
    const { bill, items, store, qrCodeUrl } = props;

    // Formatting currency
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(amount || 0);
    };

    // Calculate row-wise taxable value (Pre-Tax)
    // Formula: Total / (1 + Rate/100)
    const calculateTaxableValue = (total: number, rate: number = 0) => {
      const taxable = total / (1 + rate / 100);
      return taxable;
    };

    return (
      <div
        ref={ref}
        className="bg-white text-black font-sans mx-auto print:m-0 print:p-0"
        style={{ width: "210mm", minHeight: "297mm", padding: "15mm" }} // Default A4 feel
      >
        {/* Explicit Print CSS inside the component */}
        <style type="text/css" media="print">
          {`
          @page { 
            size: auto; 
            margin: 0mm; 
          }
          body { 
            -webkit-print-color-adjust: exact; 
            print-color-adjust: exact; 
            background: white !important;
          }
          
          /* Auto-detect Thermal Printer (80mm) vs A4 */
          @media print {
            .invoice-root {
              width: 210mm; /* A4 Default */
              padding: 10mm !important;
            }
            
            /* If user selects 80mm in print dialog, we want to scale down */
            @media (max-width: 80mm) {
              .invoice-root {
                width: 80mm !important;
                padding: 2mm !important;
                font-size: 9px !important;
              }
              .hide-on-thermal { display: none !important; }
              .thermal-compact { padding: 1mm !important; margin: 1mm !important; }
              .thermal-text-xs { font-size: 8px !important; }
              .thermal-table-compact th, .thermal-table-compact td { padding: 4px 2px !important; }
            }
          }
        `}
        </style>

        <div className="invoice-root">
          {/* Header section */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-2xl uppercase">
                  {(store?.store_name || "M")[0]}
                </div>
                <h1 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">
                  {store?.store_name || "Medical Store"}
                </h1>
              </div>
              <p className="text-[12px] text-slate-600 font-medium leading-relaxed max-w-[300px]">
                {store?.address || "Store Address NOT SET"}
              </p>
              <div className="mt-4 flex flex-wrap gap-4 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <p>GSTIN: <span className="text-slate-900">{store?.gst_number || "NOT SET"}</span></p>
                <p>DL NO: <span className="text-slate-900">{store?.dl_number || "NOT SET"}</span></p>
                <p>PH: <span className="text-slate-900">{store?.phone || "NOT SET"}</span></p>
              </div>
            </div>
            <div className="text-right">
              <div className="bg-slate-900 text-white px-4 py-2 rounded-md font-black text-sm tracking-[0.2em] mb-4 inline-block">
                TAX INVOICE
              </div>
              <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest mb-1">Invoice Number</p>
              <p className="text-xl font-black text-slate-900">{bill?.bill_number}</p>
              <div className="mt-2 text-[11px] font-bold text-slate-500">
                <p>{new Date().toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })} | {new Date().toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
          </div>

          {/* Billed To */}
          <div className="flex justify-between items-end mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">Billed To Customer</p>
              <p className="text-lg font-black text-slate-900 uppercase">
                {bill?.customer_name || "WALK-IN CUSTOMER"}
              </p>
              <p className="text-sm font-bold text-slate-500">
                {bill?.customer_phone || "CONTACT NOT PROVIDED"}
              </p>
            </div>
            <div className="text-right hide-on-thermal">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Payment Mode</p>
              <p className="text-sm font-black text-slate-900 uppercase">{bill?.payment_mode || "CASH"}</p>
            </div>
          </div>

          {/* Items Table */}
          <table className="w-full text-left text-[12px] mb-8 border-collapse thermal-table-compact">
            <thead>
              <tr className="border-b-2 border-slate-900 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <th className="py-3 px-2 w-8">#</th>
                <th className="py-3 px-2">Medicine / Item Description</th>
                <th className="py-3 px-2 text-center w-16">Qty</th>
                <th className="py-3 px-2 text-right w-20">Rate</th>
                <th className="py-3 px-2 text-right w-16">GST%</th>
                <th className="py-3 px-2 text-right w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {items?.map((item: any, i: number) => {
                const taxableValue = calculateTaxableValue(item.total, item.gst_rate);
                return (
                  <tr key={i} className="border-b border-slate-100 group">
                    <td className="py-4 px-2 text-slate-400 font-bold">{i + 1}</td>
                    <td className="py-4 px-2">
                       <p className="font-black text-slate-900 uppercase text-[13px]">{item.name}</p>
                       <p className="text-[10px] font-bold text-slate-400">HSN: 3004 | Batch: {item.batch || "N/A"}</p>
                    </td>
                    <td className="py-4 px-2 text-center font-bold text-slate-900">{item.quantity}</td>
                    <td className="py-4 px-2 text-right font-medium text-slate-600">{formatCurrency(item.sale_rate)}</td>
                    <td className="py-4 px-2 text-right font-bold text-slate-400">{item.gst_rate || 0}%</td>
                    <td className="py-4 px-2 text-right font-black text-slate-900">{formatCurrency(item.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Financials & GST Breakup */}
          <div className="flex flex-col md:flex-row gap-8 mb-10 items-start">
            {/* Tax Analysis (India Compliance) */}
            <div className="flex-1 w-full">
              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> GST Tax Analysis
                </h4>
                <table className="w-full text-[11px] font-bold text-slate-600">
                  <thead className="border-b border-slate-200">
                    <tr className="text-[9px] uppercase tracking-wider text-slate-400">
                      <th className="py-2 text-left">Tax Slab</th>
                      <th className="py-2 text-right">Taxable Val</th>
                      <th className="py-2 text-right">CGST (50%)</th>
                      <th className="py-2 text-right">SGST (50%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill?.gst_slabs && Object.entries(bill.gst_slabs).map(([rate, totalTax]: [string, any]) => (
                      <tr key={rate} className="border-b border-slate-100 last:border-0">
                        <td className="py-3">{rate}% GST</td>
                        <td className="py-3 text-right">
                          {formatCurrency((items?.filter((it: any) => String(it.gst_rate) === rate).reduce((s: number, it: any) => s + calculateTaxableValue(it.total, it.gst_rate), 0)))}
                        </td>
                        <td className="py-3 text-right">{formatCurrency(totalTax / 2)}</td>
                        <td className="py-3 text-right">{formatCurrency(totalTax / 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Final Totals */}
            <div className="w-full md:w-[320px] space-y-4">
              <div className="bg-white border-2 border-slate-900 rounded-3xl p-6 shadow-xl shadow-slate-100">
                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <span>Subtotal</span>
                    <span className="text-slate-900">{formatCurrency(items?.reduce((s: number, i: any) => s + i.total, 0))}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <span>Total Tax</span>
                    <span className="text-slate-900">+{formatCurrency(bill?.gst_amount)}</span>
                  </div>
                  {bill?.round_off !== 0 && (
                    <div className="flex justify-between items-center text-[10px] font-bold text-blue-500 uppercase italic">
                      <span>Round Off</span>
                      <span>{bill?.round_off > 0 ? "+" : ""}{bill?.round_off.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                <div className="pt-6 border-t-2 border-dashed border-slate-200">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.3em] mb-1">Net Payable</p>
                  <div className="text-4xl font-black text-slate-900 tracking-tighter">
                    {formatCurrency(bill?.total_amount)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center border-t-2 border-slate-100 pt-8 mt-auto">
             <div className="space-y-2 text-[11px] font-medium text-slate-500">
                <p className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-300 rounded-full" /> Medicines once sold cannot be returned.</p>
                <p className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-300 rounded-full" /> This is a computer generated invoice.</p>
                <p className="flex items-center gap-2 font-black text-slate-900 mt-4 uppercase tracking-widest">Thank you for your visit!</p>
             </div>
             
             {qrCodeUrl && (
               <div className="flex flex-col items-center md:items-end justify-center">
                 <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 group hover:border-slate-900 transition-colors">
                    <img src={qrCodeUrl} alt="Payment QR" className="w-24 h-24" />
                 </div>
                 <p className="text-[9px] font-black uppercase text-slate-400 mt-2 tracking-[0.2em]">Scan & Pay Securely</p>
               </div>
             )}
          </div>
        </div>
      </div>
    );
  }
);

InvoiceTemplate.displayName = "InvoiceTemplate";
