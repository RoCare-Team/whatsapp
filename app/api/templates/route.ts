/**
 * GET  /api/templates  — list workspace templates
 * POST /api/templates  — create + submit to Meta for approval
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query, insert, execute } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/utils';
import { RowDataPacket } from 'mysql2';
import axios from 'axios';

// ─── GET ─────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    const templates = await query<RowDataPacket[]>(
      'SELECT * FROM templates WHERE workspace_id = ? ORDER BY created_at DESC',
      [payload.workspaceId]
    );
    return apiSuccess(templates);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    return apiError('Server error', 500);
  }
}

// ─── POST ────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const payload = requireAuth(req);
    const body = await req.json();

    const {
      name, language, category,
      header_type, header_content,
      body_text, footer_text,
      buttons = [],
      variables = [],
      var_samples = {},   // { '{{1}}': 'John', '{{2}}': 'ORD-123' }
    } = body;

    if (!name || !body_text) return apiError('Name and body text are required');

    // ── 1. Resolve credentials: DB → ENV fallback ────────────
    const ws = await query<RowDataPacket[]>(
      'SELECT access_token, waba_id FROM workspaces WHERE id = ?',
      [payload.workspaceId]
    );
    const wsRow      = ws[0] || {};
    const accessToken = (wsRow.access_token as string) || process.env.WHATSAPP_ACCESS_TOKEN || '';
    const wabaId      = (wsRow.waba_id      as string) || process.env.WABA_ID              || '';

    // ── 2. Save to DB first ──────────────────────────────────
    const id = await insert(
      `INSERT INTO templates
       (workspace_id, name, language, category, header_type, header_content,
        body_text, footer_text, buttons, variables, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
      [
        payload.workspaceId,
        name,
        language   || 'en',
        category   || 'UTILITY',
        (header_type === 'NONE' ? 'TEXT' : header_type) || 'TEXT',
        header_type === 'NONE' ? '' : (header_content || ''),
        body_text,
        footer_text || '',
        JSON.stringify(buttons),
        JSON.stringify(variables),
      ]
    );

    // ── 3. Submit to Meta if credentials available ───────────
    if (!accessToken || !wabaId) {
      return apiSuccess(
        { id, meta_submitted: false, warning: 'WhatsApp credentials not configured. Template saved locally. Go to Settings to add your API credentials.' },
        201
      );
    }

    try {
      const components = buildMetaComponents({
        header_type,
        header_content,
        body_text,
        footer_text,
        buttons,
        var_samples,
      });

      const metaPayload = {
        name,
        language:   language || 'en',
        category:   category || 'UTILITY',
        components,
      };

      console.log('[Meta Template Submit]', JSON.stringify(metaPayload, null, 2));

      const metaRes = await axios.post(
        `https://graph.facebook.com/v19.0/${wabaId}/message_templates`,
        metaPayload,
        {
          headers: {
            Authorization:  `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const metaData = metaRes.data as { id: string; status: string };
      console.log('[Meta Template Response]', metaData);

      // Update DB with Meta ID and status
      await execute(
        'UPDATE templates SET meta_template_id = ?, status = ? WHERE id = ?',
        [metaData.id, metaData.status || 'PENDING', id]
      );

      return apiSuccess({ id, meta_submitted: true, meta_id: metaData.id, status: metaData.status }, 201);

    } catch (metaErr: unknown) {
      // Meta submission failed — log error, template still saved locally
      let metaError = 'Meta API error';
      if (axios.isAxiosError(metaErr)) {
        const errData = metaErr.response?.data as Record<string, unknown> | undefined;
        const fbError = (errData?.error as Record<string, unknown>) || {};
        metaError = (fbError.message as string) || metaErr.message;
        console.error('[Meta Template Error]', JSON.stringify(errData, null, 2));
      } else if (metaErr instanceof Error) {
        metaError = metaErr.message;
      }

      // Mark as failed in DB
      await execute('UPDATE templates SET status = ? WHERE id = ?', ['REJECTED', id]);

      return NextResponse.json({
        success:       false,
        meta_submitted: false,
        local_id:      id,
        error:         `Meta API Error: ${metaError}`,
      }, { status: 422 });
    }

  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'UNAUTHORIZED') return apiError('Unauthorized', 401);
    console.error('[templates POST]', err);
    return apiError('Server error', 500);
  }
}

// ─── Build Meta API components array ─────────────────────────
function buildMetaComponents(opts: {
  header_type:    string;
  header_content: string;
  body_text:      string;
  footer_text:    string;
  buttons:        { type: string; text: string; url?: string; url_type?: string; phone?: string }[];
  var_samples:    Record<string, string>;
}) {
  const { header_type, header_content, body_text, footer_text, buttons, var_samples } = opts;
  const components: object[] = [];

  // ── HEADER component ──────────────────────────────────────
  if (header_type && header_type !== 'NONE' && header_content) {
    if (header_type === 'TEXT') {
      components.push({ type: 'HEADER', format: 'TEXT', text: header_content });
    } else {
      // IMAGE / DOCUMENT / VIDEO
      components.push({
        type:    'HEADER',
        format:  header_type,
        example: {
          header_url: [header_content],
        },
      });
    }
  }

  // ── BODY component ────────────────────────────────────────
  // Extract variables like {{1}}, {{2}} from body text
  const varMatches = [...new Set(body_text.match(/\{\{\d+\}\}/g) || [])];
  const bodyComponent: Record<string, unknown> = { type: 'BODY', text: body_text };

  if (varMatches.length > 0) {
    // Build example body_text array using sample values
    const exampleValues = varMatches.map((v) => var_samples[v] || `Sample_${v.replace(/\{\{|\}\}/g, '')}`);
    bodyComponent.example = { body_text: [exampleValues] };
  }

  components.push(bodyComponent);

  // ── FOOTER component ──────────────────────────────────────
  if (footer_text) {
    components.push({ type: 'FOOTER', text: footer_text });
  }

  // ── BUTTONS component ─────────────────────────────────────
  if (buttons && buttons.length > 0) {
    const metaButtons: object[] = buttons.map((btn) => {
      if (btn.type === 'QUICK_REPLY') {
        return { type: 'QUICK_REPLY', text: btn.text };
      }
      if (btn.type === 'URL') {
        const isDynamic = btn.url_type === 'dynamic';
        // Dynamic URL: base URL without {{1}}, example shows the full URL
        const baseUrl = isDynamic
          ? (btn.url || '').replace(/\{\{1\}\}.*$/, '')
          : (btn.url || '');
        return {
          type:       'URL',
          text:       btn.text,
          url:        isDynamic ? `${baseUrl}{{1}}` : baseUrl,
          ...(isDynamic ? { example: [(btn.url || '').replace('{{1}}', 'sample-value')] } : {}),
        };
      }
      if (btn.type === 'PHONE_NUMBER') {
        return { type: 'PHONE_NUMBER', text: btn.text, phone_number: btn.phone || '' };
      }
      return {};
    });

    components.push({ type: 'BUTTONS', buttons: metaButtons });
  }

  return components;
}
