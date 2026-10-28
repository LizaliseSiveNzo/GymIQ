import { admin, authenticate, json } from '../_shared/launch.ts';
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({});
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const user = await authenticate(req);
  if (!user) return json({ error: 'Sign in first.' }, 401);
  try {
    const { ticketId } = await req.json();
    const { data: ticket, error } = await admin().from('support_requests').select('id,subject,message').eq('id', ticketId).eq('user_id', user.id).single();
    if (error) return json({ error: 'Support request not found.' }, 404);
    const key = Deno.env.get('RESEND_API_KEY'), from = Deno.env.get('GYMIQ_EMAIL_FROM'), to = 'Lizalisenzo@gmail.com';
    if (!key || !from || !to) return json({ saved: true, emailed: false });
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `support-${ticket.id}` },
      body: JSON.stringify({ from, to: [to], reply_to: user.email, subject: `GymIQ support: ${ticket.subject}`,
        text: `Ticket: ${ticket.id}\nFrom: ${user.email}\n\n${ticket.message}` }),
    });
    return json({ saved: true, emailed: response.ok });
  } catch { return json({ saved: true, emailed: false }); }
});
