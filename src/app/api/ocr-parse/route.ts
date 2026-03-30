import { NextRequest, NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

let ocrRateLimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ocrRateLimit = new Ratelimit({
    redis: new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(3, '10 s'),
    analytics: true,
  });
}

export async function POST(req: NextRequest) {
  try {
    if (ocrRateLimit) {
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
      const { success } = await ocrRateLimit.limit(`ocr_${ip}`);
      if (!success) {
        return NextResponse.json({ error: "Too Many Requests. OCR Edge Throttled." }, { status: 429 });
      }
    }

    const contentType = req.headers.get('content-type') || '';
    let text = "";

    if (contentType.includes('application/json')) {
      const body = await req.json();
      text = body.text || "";
    } else {
      const formData = await req.formData();
      const image = formData.get('image') as File;
      if (image) {
        const buffer = Buffer.from(await image.arrayBuffer());
        const { data } = await Tesseract.recognize(buffer, 'eng');
        text = data.text;
      }
    }

    if (!text && !contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'No text or image provided' }, { status: 400 });
    }

    // Basic parsing logic (very rudimentary for demonstration)
    // In a real app, this would be a more robust AI-based extractor
    const lines = text.split('\n');
    const medicineData = {
      name: "Parsed Medicine",
      mrp: 0,
      expiry_date: "",
      batch_number: "",
      raw_text: text.slice(0, 500) // return snippet for debugging
    };

    // Simple Regex patterns for extraction
    const mrpMatch = text.match(/MRP[:\s]*(\d+\.?\d*)/i);
    if (mrpMatch) medicineData.mrp = parseFloat(mrpMatch[1]);

    const expiryMatch = text.match(/EXP[:\s]*(\d{2}\/\d{2,4})/i) || text.match(/Expiry[:\s]*(\d{2}\/\d{2,4})/i);
    if (expiryMatch) medicineData.expiry_date = expiryMatch[1];

    const batchMatch = text.match(/BATCH[:\s]*([A-Z0-9]+)/i);
    if (batchMatch) medicineData.batch_number = batchMatch[1];

    if (!medicineData.mrp && !medicineData.expiry_date) {
      return NextResponse.json({ error: 'OCR Processing failed to identify reliable pricing or expiry fields.' }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true, 
      data: medicineData 
    });

  } catch (error: any) {
    console.error('OCR Parse Error:', error);
    return NextResponse.json({ error: error.message || 'Internal AI OCR system collapse.' }, { status: 500 });
  }
}
