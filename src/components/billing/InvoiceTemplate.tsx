import React from 'react';

// Using forwardRef as required by react-to-print
export const InvoiceTemplate = React.forwardRef<HTMLDivElement, any>((props, ref) => {
  const { bill, items, store, qrCodeUrl } = props;

  // Formatting currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
  };

  return (
    <div ref={ref} className="p-8 bg-white text-black font-sans w-[800px] max-w-full mx-auto" style={{ minHeight: '1000px' }}>
      
      {/* Explicit Print CSS inside the component */}
      <style type="text/css" media="print">
        {`
          @page { size: auto; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          
          /* Thermal styling class (optional if user wants to toggle thermal printing) */
          @media print {
            .thermal-mode {
              width: 80mm !important;
              padding: 2mm !important;
              font-size: 12px !important;
            }
          }
        `}
      </style>

      {/* Header section */}
      <div className="text-center border-b-2 border-black pb-6 mb-6">
        <h1 className="text-4xl font-black uppercase tracking-wider mb-2 text-slate-900">
          {store?.name || 'Medical Store'}
        </h1>
        <p className="text-sm text-slate-700 whitespace-pre-wrap">{store?.address || 'Store Address NOT SET'}</p>
        <p className="text-sm font-semibold mt-1">GSTIN: {store?.gst_no || 'NOT SET'}</p>
      </div>

      {/* Invoice Meta */}
      <div className="flex justify-between items-start text-sm mb-8 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div>
          <p className="mb-1"><span className="font-semibold text-slate-500">Invoice No:</span> <span className="font-bold text-slate-900 text-lg">{bill?.bill_number}</span></p>
          <p><span className="font-semibold text-slate-500">Date:</span> {new Date().toLocaleDateString('en-IN')}</p>
          <p><span className="font-semibold text-slate-500">Time:</span> {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <div className="text-right">
          <p className="mb-1"><span className="font-semibold text-slate-500">Billed To:</span></p>
          <p className="font-bold text-slate-900 text-base">{bill?.customer_name || 'Walk-in Customer'}</p>
          <p className="text-slate-600">{bill?.customer_phone || 'No Phone Number'}</p>
        </div>
      </div>

      {/* Items Table */}
      <table className="w-full text-left text-sm mb-8 border-collapse border border-slate-300">
        <thead className="bg-slate-100">
          <tr>
            <th className="py-3 px-4 border-b border-r border-slate-300 font-bold text-slate-800 w-12 text-center">#</th>
            <th className="py-3 px-4 border-b border-r border-slate-300 font-bold text-slate-800">Medicine / Item</th>
            <th className="py-3 px-4 border-b border-r border-slate-300 font-bold text-slate-800 text-center w-24">Qty</th>
            <th className="py-3 px-4 border-b border-r border-slate-300 font-bold text-slate-800 text-right w-32">Rate</th>
            <th className="py-3 px-4 border-b border-slate-300 font-bold text-slate-800 text-right w-32">Total</th>
          </tr>
        </thead>
        <tbody>
          {items?.map((item: any, i: number) => (
            <tr key={i} className="border-b border-slate-200">
              <td className="py-3 px-4 text-center border-r border-slate-200 text-slate-500">{i + 1}</td>
              <td className="py-3 px-4 border-r border-slate-200 font-medium">{item.name}</td>
              <td className="py-3 px-4 text-center border-r border-slate-200">{item.quantity}</td>
              <td className="py-3 px-4 text-right border-r border-slate-200">{formatCurrency(item.price)}</td>
              <td className="py-3 px-4 text-right font-semibold">{formatCurrency(item.quantity * item.price)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals Section */}
      <div className="flex justify-end mb-10">
        <div className="w-1/2 min-w-[300px] border border-slate-300 rounded-lg overflow-hidden bg-slate-50">
          <div className="flex justify-between py-3 px-6 text-sm border-b border-slate-200">
            <span className="text-slate-600 font-medium">Subtotal</span>
            <span className="font-medium">{formatCurrency((bill?.total_amount || 0) - (bill?.gst_amount || 0))}</span>
          </div>
          <div className="flex justify-between py-3 px-6 text-sm border-b border-slate-300">
            <span className="text-slate-600 font-medium">GST Tax Component</span>
            <span className="font-medium">{formatCurrency(bill?.gst_amount || 0)}</span>
          </div>
          <div className="flex justify-between py-4 px-6 text-xl font-black bg-slate-100/50">
            <span>NET PAYABLE</span>
            <span>{formatCurrency(bill?.total_amount || 0)}</span>
          </div>
        </div>
      </div>

      {/* Footer & QR */}
      <div className="flex flex-col items-center justify-center text-center mt-auto pt-8 border-t-2 border-dashed border-slate-300">
        {qrCodeUrl && (
          <div className="mb-6 p-4 border border-slate-200 rounded-xl bg-white shadow-sm inline-block">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Scan to Pay securely</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCodeUrl} alt="UPI Payment QR Code" className="w-32 h-32 mx-auto" />
            <p className="text-xs font-bold text-emerald-600 mt-2">Verified UPI ID</p>
          </div>
        )}
        
        <h3 className="text-lg font-bold text-slate-800">Thank you for choosing {store?.name || 'our store'}!</h3>
        <p className="text-sm text-slate-500 mt-2">Medications cannot be returned or exchanged once billed.</p>
        <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider font-semibold">This is a computer generated invoice.</p>
      </div>

    </div>
  );
});

InvoiceTemplate.displayName = 'InvoiceTemplate';
