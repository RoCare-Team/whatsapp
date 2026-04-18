import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { RowDataPacket } from 'mysql2';

const GV = 'v20.0';
const FREE_TIER = 1000;

interface DataPoint {
  start: number;
  end: number;
  conversation: number;
  cost: number;
  conversation_category?: string;
}

export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    const { searchParams } = new URL(req.url);

    const monthParam = searchParams.get('month') || new Date().toISOString().slice(0, 7);
    const [year, month] = monthParam.split('-').map(Number);

    const start = Math.floor(new Date(year, month - 1, 1).getTime() / 1000);
    const end   = Math.floor(new Date(year, month, 0, 23, 59, 59).getTime() / 1000);

    const rows = await query<RowDataPacket[]>(
      `SELECT waba_id, access_token FROM workspaces WHERE id = ?`,
      [payload.workspaceId]
    );

    if (!rows.length || !rows[0].waba_id || !rows[0].access_token) {
      return apiError('WhatsApp not connected', 400);
    }

    const { waba_id, access_token } = rows[0];

    const url = new URL(`https://graph.facebook.com/${GV}/${waba_id}/conversation_analytics`);
    url.searchParams.set('start', String(start));
    url.searchParams.set('end', String(end));
    url.searchParams.set('granularity', 'DAILY');
    url.searchParams.set('dimensions', JSON.stringify(['CONVERSATION_CATEGORY']));
    url.searchParams.set('access_token', access_token);

    const res      = await fetch(url.toString());
    const metaData = await res.json();

    if (metaData.error) {
      return apiError(`Meta: ${metaData.error.message}`, 400);
    }

    const dataPoints: DataPoint[] = metaData.data?.[0]?.data_points || [];

    type DayRow = { date: string; marketing: number; utility: number; authentication: number; service: number; cost: number };
    type CategoryRow = { conversations: number; cost: number };

    const byDay: Record<string, DayRow> = {};
    const byCategory: Record<string, CategoryRow> = {
      MARKETING:      { conversations: 0, cost: 0 },
      UTILITY:        { conversations: 0, cost: 0 },
      AUTHENTICATION: { conversations: 0, cost: 0 },
      SERVICE:        { conversations: 0, cost: 0 },
    };

    let totalConversations = 0;
    let totalCost          = 0;

    for (const dp of dataPoints) {
      const date     = new Date(dp.start * 1000).toISOString().slice(0, 10);
      const category = (dp.conversation_category || 'SERVICE').toUpperCase();
      const count    = dp.conversation || 0;
      const cost     = dp.cost || 0;

      if (!byDay[date]) {
        byDay[date] = { date, marketing: 0, utility: 0, authentication: 0, service: 0, cost: 0 };
      }

      const catKey = category.toLowerCase() as keyof DayRow;
      if (catKey in byDay[date] && catKey !== 'date' && catKey !== 'cost') {
        (byDay[date][catKey] as number) += count;
      }
      byDay[date].cost += cost;

      if (byCategory[category]) {
        byCategory[category].conversations += count;
        byCategory[category].cost          += cost;
      }

      totalConversations += count;
      totalCost          += cost;
    }

    // Round costs
    for (const cat of Object.values(byCategory)) {
      cat.cost = Math.round(cat.cost * 10000) / 10000;
    }
    for (const day of Object.values(byDay)) {
      day.cost = Math.round(day.cost * 10000) / 10000;
    }

    return apiSuccess({
      month: monthParam,
      summary: {
        total_conversations:  totalConversations,
        total_cost:           Math.round(totalCost * 10000) / 10000,
        free_tier_used:       Math.min(totalConversations, FREE_TIER),
        free_tier_remaining:  Math.max(0, FREE_TIER - totalConversations),
        paid_conversations:   Math.max(0, totalConversations - FREE_TIER),
      },
      by_category: byCategory,
      daily: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[billing]', err);
    return apiError('Server error', 500);
  }
}
