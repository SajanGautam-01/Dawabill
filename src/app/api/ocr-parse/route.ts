import { NextRequest, NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
    
    const medicineData = {
      name: "Smart Extraction",
      mrp: 0,
      expiry_date: "",
      batch_number: "",
    };

    // ─── PHARMACY PATTERN MATCHING ──────────────────────────────────────────
    const patterns = {
      // Matches: MRP 150, Rs. 150.00, ₹150, Price 150, or standalone 150.00
      mrp: [
        /(?:MRP|RS|₹|PRICE|RATE)[:\s]*(\d+\.?\d*)/i,
        /(\d+\.\d{2})/
      ],
      // Matches: 12/25, 12/2025, 2025-12, EXP: 12/25
      expiry: [
        /(?:EXP|EXPIRY|VALID)[:\s]*(\d{2}\/\d{2,4})/i,
        /(\d{2}\/\d{2,4})/
      ],
      // Matches: B.No. AB123, Batch AB123, Lot AB123, or 5-15 alphanumeric characters
      batch: [
        /(?:BATCH|B\.?NO|LOT|L\.?NO)[:\s]*([A-Z0-9-]+)/i,
        /([A-Z0-9-]{6,15})/
      ]
    };

    // 1. MRP Extraction
    for (const p of patterns.mrp) {
      const match = text.match(p);
      if (match) {
        const val = parseFloat(match[1] || match[0]);
        if (!isNaN(val) && val > 0) {
          medicineData.mrp = val;
          break;
        }
      }
    }

    // 2. Expiry Extraction
    for (const p of patterns.expiry) {
      const match = text.match(p);
      if (match) {
        medicineData.expiry_date = match[1] || match[0];
        break;
      }
    }

    // 3. Batch Extraction
    for (const p of patterns.batch) {
      const match = text.match(p);
      if (match) {
        let b = match[1] || match[0];
        b = b.replace(/BATCH|LOT|B\.?NO|L\.?NO|[:\s]*/gi, '');
        if (b.length >= 4) {
          medicineData.batch_number = b.toUpperCase();
          break;
        }
      }
    }

    // 4. Product Name Extraction (Smart Logic)
    // Rule: Find the first line that is mostly uppercase and doesn't contain forbidden keywords
    const forbidden = /MRP|EXP|BATCH|LOT|PRICE|DATE|MFG|RS|₹|TABLET|CAPSULE/i;
    const nameLine = lines.find((l: string) => 
      l.length > 4 && 
      !forbidden.test(l) && 
      (l === l.toUpperCase() || (l.match(/[A-Z]/g)?.length || 0) > l.length * 0.5)
    );

    if (nameLine) {
      medicineData.name = nameLine.trim();
    } else {
      // Fallback: Use the longest non-keyword line
      const longest = lines
        .filter((l: string) => !forbidden.test(l))
        .sort((a: string, b: string) => b.length - a.length)[0];
      medicineData.name = longest || "Parsed Item";
    }

    return NextResponse.json({ 
      success: true, 
      data: medicineData 
    });

  } catch (error: any) {
    console.error('OCR Parse Error:', error);
    return NextResponse.json({ error: 'System processing failure' }, { status: 500 });
  }
}
