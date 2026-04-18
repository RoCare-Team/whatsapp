/**
 * POST /api/auth/meta
 * Given a Facebook user access token, return all WABAs + phone numbers
 * so the frontend can let the user pick which one to connect.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { apiError } from '@/lib/utils';

const GV = 'v20.0';

export async function POST(req: NextRequest) {
  try {
    requireAuth(req);
    const { access_token } = await req.json();
    if (!access_token) return apiError('access_token required', 400);

    // 1. Get user's businesses
    const bizRes = await fetch(
      `https://graph.facebook.com/${GV}/me/businesses?fields=id,name,whatsapp_business_accounts{id,name,currency,timezone_id}&access_token=${access_token}`
    );
    const bizData = await bizRes.json();
    if (bizData.error) return apiError(`Meta: ${bizData.error.message}`, 400);

    const businesses: {
      id: string; name: string;
      whatsapp_business_accounts?: { data: { id: string; name: string }[] };
    }[] = bizData.data || [];

    // Collect all WABAs across businesses
    const wabas: { id: string; name: string; business_name: string }[] = [];
    for (const biz of businesses) {
      for (const waba of (biz.whatsapp_business_accounts?.data || [])) {
        wabas.push({ id: waba.id, name: waba.name || waba.id, business_name: biz.name });
      }
    }

    // 2. For each WABA, fetch phone numbers
    const wabasWithPhones = await Promise.all(
      wabas.map(async (waba) => {
        const phoneRes = await fetch(
          `https://graph.facebook.com/${GV}/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status&access_token=${access_token}`
        );
        const phoneData = await phoneRes.json();
        return {
          ...waba,
          phone_numbers: (phoneData.data || []) as {
            id: string;
            display_phone_number: string;
            verified_name: string;
            code_verification_status: string;
          }[],
        };
      })
    );

    return NextResponse.json({ success: true, data: wabasWithPhones });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Failed to fetch Meta data', 500);
  }
}
