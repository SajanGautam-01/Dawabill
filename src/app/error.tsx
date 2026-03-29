'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertCircle, RefreshCcw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Root Error Boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center mb-6 shadow-inner border border-red-200 animate-in fade-in zoom-in duration-200">
        <AlertCircle size={36} strokeWidth={2.5} />
      </div>
      
      <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">Something went wrong!</h2>
      <p className="text-slate-500 max-w-md mx-auto mb-8 font-medium">
        DawaBill encountered an unexpected error. Don't worry, your data is safe. Please try refreshing the page.
      </p>

      <div className="flex flex-col sm:flex-row gap-4">
        <Button 
          onClick={() => reset()}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold h-12 px-8 rounded-xl shadow-lg shadow-blue-500/20 flex items-center gap-2"
        >
          <RefreshCcw size={18} /> Try again
        </Button>
        
        <Button 
          variant="outline"
          size="lg"
          onClick={() => window.location.href = '/dashboard'}
          className="bg-white border-2 border-slate-200 text-slate-700 font-bold h-12 px-8 rounded-xl"
        >
          Go to Dashboard
        </Button>
      </div>

      <div className="mt-12 p-4 bg-slate-100 rounded-2xl border border-slate-200 max-w-2xl w-full text-left overflow-auto max-h-[200px]">
        <p className="text-xs font-mono text-slate-500 whitespace-pre-wrap">{error.message || 'Unknown application error'}</p>
        {error.digest && <p className="text-[10px] font-mono text-slate-400 mt-2">ID: {error.digest}</p>}
      </div>
    </div>
  );
}
