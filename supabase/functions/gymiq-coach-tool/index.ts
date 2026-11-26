// gymiq-coach-tool: validates and saves a draft proposal from the voice coach's
// tool call, so the user can review and apply it exactly like a text-coach proposal.
import { createClient } from 'npm:@supabase/supabase-js@2.45.0';
import { admin, authenticate, json } from '../_shared/launch.ts';
import { buildCoachContext } from '../_shared/coachContext.js';
import { validateTool } from '../_shared/coach.js';

const ALLOWED = ['draft_meal', 'log_food', 'draft_meal_plan', 'draft_workout'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return json({});
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const user = await authenticate(req);
  if (!user) return json({ error: 'Sign in to use your coach.' }, 401);
  try {
    const raw = await req.text();
    if (raw.length > 40000) return json({ error: 'That request is too large.' }, 400);
    const body = JSON.parse(raw);
    const name = body?.name, args = body?.args || {};
    if (typeof name !== 'string' || !ALLOWED.includes(name)) return json({ error: 'That action is not supported.' }, 400);
    const scoped = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } }, auth: { persistSession: false } },
    );
    const membership = await scoped.rpc('has_active_membership');
    if (membership.error || membership.data !== true) return json({ error: 'This feature is only for paid users.' }, 403);
    const day = new Date().toISOString().slice(0, 10);
    const { context, baseline } = await buildCoachContext(scoped, { userId: user.id, day });
    const proposal = validateTool(name, args, context);
    const db = admin();
    const turnId = crypto.randomUUID();
    const actionId = crypto.randomUUID();
    await db.from('coach_turns').insert({ id: turnId, user_id: user.id, prompt: '[voice]', status: 'done' });
    const ins = await db.from('coach_actions').insert({ id: actionId, user_id: user.id, turn_id: turnId, kind: proposal.kind, payload: proposal.payload, baseline });
    if (ins.error) throw Error('Could not save the proposal.');
    return json({ id: actionId, kind: proposal.kind, payload: proposal.payload, status: 'draft' });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const safe = /^(Use |Choose |This |Mixed |Please |Save |A |Meal |Could |Plan |Keep |That |Unsupported |Invalid )/.test(message) ? message : 'Could not prepare that. Please try again.';
    return json({ error: safe }, 400);
  }
});
