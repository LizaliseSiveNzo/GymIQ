/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM_PROMPT = `You are a youth sports development assistant for GymIQ. Given a player's recent stats and coach notes, write a short encouraging but honest performance summary (max 150 words). Include: what the player is doing well, one area to improve, one practical home training tip. Write for both a parent and a 13-year-old to understand. Do not invent statistics that are not provided.`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Missing authorization' }, 401);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    let playerId: string | null = null;
    try { const body = await req.json(); playerId = body?.player_id ?? null; } catch (_e) { /* no body */ }
    const { data: ctx, error } = await supabase.rpc('player_ai_context', { p_player: playerId });
    if (error) return json({ error: error.message }, 400);
    if (!ctx) return json({ error: 'No player data available or not authorized.' }, 403);
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return json({ error: 'AI is not configured yet. Add the ANTHROPIC_API_KEY secret to enable summaries.' }, 503);
    const model = Deno.env.get('CLAUDE_MODEL') ?? 'claude-sonnet-4-6';
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 400, system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: 'Player data (JSON):\n' + JSON.stringify(ctx) }] }),
    });
    if (!resp.ok) { const t = await resp.text(); return json({ error: `Claude API error ${resp.status}: ${t.slice(0,300)}` }, 502); }
    const data = await resp.json();
    return json({ summary: data?.content?.[0]?.text ?? '', model });
  } catch (e) { return json({ error: String(e) }, 500); }
});
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
