import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { logger } from './lib/logger';

// Note: In-memory store on Vercel Edge is per-isolate.
// For strict global rate limiting, use Upstash Redis.
const rateLimitStore = new Map<string, { count: number; lastReset: number }>();

const LIMIT = 10; // 10 requests
const WINDOW = 1000; // 1 second (per IP)

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only guard API routes
  if (pathname.startsWith('/api/')) {
    const ip = request.ip || 'anonymous';
    const now = Date.now();
    const windowStart = rateLimitStore.get(ip);

    if (!windowStart || now - windowStart.lastReset > WINDOW) {
      rateLimitStore.set(ip, { count: 1, lastReset: now });
      return NextResponse.next();
    }

    if (windowStart.count >= LIMIT) {
      // Step 3: Log abuse attempt
      logger.warn(`Rate limit exceeded for IP: ${ip}`, { 
        action: 'api_ratelimit', 
        metadata: { path: pathname, ip } 
      });

      return new NextResponse(
        JSON.stringify({ error: 'Too many requests. Please slow down.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    windowStart.count++;
    return NextResponse.next();
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: '/api/:path*',
};
