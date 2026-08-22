// form-coach: turns measured form-check metrics into a short, friendly coaching
// paragraph using Gemini Flash (cheap). The heavy lifting (pose estimation,
// scoring) happens on-device for free; this only rewrites the wording.
// Requires secret GEMINI_API_KEY. If it's absent or the call fails, it returns
// { summary: null } and the app keeps its built-in summary.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { ...cors, 'content-type': 'application/json' } });
  try {
    const key = Deno.env.get('GEMINI_API_KEY');
    if (!key) return json({ summary: null });
    const { exercise, score, reps, metrics, cues } = await req.json();
    const points = (cues || []).map((c: { title: string; detail: string }) => `${c.title}: ${c.detail}`).join(' | ');
    const prompt = `You are a supportive, knowledgeable strength coach talking directly to a lifter.\n`
      + `Exercise: ${exercise}. Score: ${score}/100 across ${reps} reps.\n`
      + `Measured metrics: ${JSON.stringify(metrics)}.\n`
      + `Detected form points: ${points}.\n`
      + `Write 2-3 short sentences of encouraging, specific feedback in plain language. `
      + `Lead with what went well, then the single most important thing to fix. No markdown, no lists.`;
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.6, maxOutputTokens: 200 } }),
    });
    const j = await r.json();
    const summary = j?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    return json({ summary });
  } catch (e) {
    return json({ summary: null, error: String(e) });
  }
});
