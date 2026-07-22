/*
 * Copyright © 2026 Lizalise Nzo. All rights reserved.
 * GymIQ — proprietary and confidential. See LICENSE.
 */

// email-dispatch: flushes the notification email queue.
// Sends every notifications row with emailed=false to the user's email via Resend,
// then marks it emailed. Invoked automatically by a DB trigger (pg_net) whenever
// notifications are inserted; safe to call repeatedly (idempotent queue flush).
//
// Required secrets: RESEND_API_KEY  (https://resend.com — free tier is fine)
// Optional:         EMAIL_FROM      e.g. "GymIQ <updates@yourdomain.co.za>"
//                   (defaults to Resend's test sender, which only delivers to
//                    the Resend account owner's own inbox)

import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (_req: Request) => {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const FROM = Deno.env.get('EMAIL_FROM') ?? 'GymIQ <onboarding@resend.dev>';

  if (!RESEND_API_KEY) {
    // Not configured yet — leave the queue untouched so emails go out once a key is set.
    return json({ ok: false, error: 'RESEND_API_KEY not set' });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: pending, error } = await supabase
    .from('notifications')
    .select('id, message, created_at, users ( email, name )')
    .eq('emailed', false)
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!pending || pending.length === 0) return json({ ok: true, sent: 0 });

  let sent = 0;
  const done: string[] = [];

  for (const n of pending) {
    const user = Array.isArray(n.users) ? n.users[0] : n.users;
    const email = user?.email;
    if (!email || email.endsWith('@gymiq.app')) {
      // test/seed accounts have no real inbox — just mark as handled
      done.push(n.id);
      continue;
    }
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM,
          to: [email],
          subject: `GymIQ — ${n.message.slice(0, 60)}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
              <h2 style="color:#16305C">GymIQ</h2>
              <p style="font-size:15px;color:#222">${escapeHtml(n.message)}</p>
              <p style="font-size:12px;color:#888">You're receiving this because your academy uses GymIQ.
              Open the app to see full details.</p>
            </div>`,
        }),
      });
      if (r.ok) { sent++; done.push(n.id); }
      else console.error('resend error', n.id, await r.text()); // left in queue → retried on next flush
    } catch (e) {
      console.error('send failed', n.id, e);
    }
  }

  if (done.length) await supabase.from('notifications').update({ emailed: true }).in('id', done);
  return json({ ok: true, sent, processed: done.length });
});

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
