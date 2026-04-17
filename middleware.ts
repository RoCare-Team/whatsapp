/**
 * middleware.ts
 * Minimal middleware — auth protection is handled client-side in layouts.
 * Middleware sirf static files ko skip karta hai.
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(_req: NextRequest) {
  // Sab kuch allow karo — auth check client-side layouts mein hoti hai
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
