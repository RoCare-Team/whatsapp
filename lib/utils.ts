/**
 * lib/utils.ts
 * General utility helpers
 */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { NextResponse } from 'next/server';

// ---- Tailwind class merging ----
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---- Standardised API responses ----
export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

// ---- Pagination helper ----
export function getPagination(searchParams: URLSearchParams) {
  const page  = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// ---- Phone normalizer: ensure E.164 without '+' ----
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

// ---- Sleep (for rate limiting bulk sends) ----
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---- Rate limit: 80 messages / second for Cloud API ----
export const WA_RATE_LIMIT_MS = 15; // ~66/sec, safe below 80/sec limit
