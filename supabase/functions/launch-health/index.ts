// Operational readiness only. Never returns credentials or customer data.
Deno.serve((req: Request) => {
  if (req.method !== 'GET') return new Response(null, { status: 405 });
  return Response.json({
    checkoutKeyConfigured: Boolean(Deno.env.get('YOCO_SECRET_KEY')),
    webhookConfigured: Boolean(Deno.env.get('YOCO_WEBHOOK_SECRET')),
    appUrlConfigured: Boolean(Deno.env.get('GYMIQ_APP_URL')),
    emailKeyConfigured: Boolean(Deno.env.get('RESEND_API_KEY')),
    emailSenderConfigured: Boolean(Deno.env.get('GYMIQ_EMAIL_FROM')),
  });
});
