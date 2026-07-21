// Structures an ad hoc project/focus area against the OnePage priorities and core values.
// Uses Claude when ANTHROPIC_API_KEY is set; otherwise a keyword heuristic fallback.

export async function POST(req) {
  const { raw, one_page = {}, core_values = [], role_title = '' } = await req.json();
  const key = process.env.ANTHROPIC_API_KEY;

  if (key) {
    try {
      const prompt = `You structure onboarding plan items for a new leader's 30/60/90 plan.

Organization OnePage:
${JSON.stringify(one_page)}

Core values:
${JSON.stringify(core_values)}

New leader's role: ${role_title}

The manager or employee wants to add this to the plan:
"${raw}"

Return ONLY a JSON object, no other text:
{
  "title": "clear, outcome-oriented restatement (max 140 chars)",
  "phase": 30 | 60 | 90,
  "track": "impact" | "acclimation",
  "tags": ["P1".."P4" and/or "V1".."V6" — the priorities/values this genuinely serves, 1-3 tags],
  "success_measure": "concrete 'done means' statement, observable, max 120 chars",
  "rationale": "one sentence on why this phase and tags"
}
Phase logic: learning/mapping/relationship-building → 30; owning/operating → 60; systemizing/documenting/scaling → 90.`;

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
          max_tokens: 400,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const j = await r.json();
      const text = j?.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        return Response.json({ source: 'ai', ...parsed });
      }
    } catch (e) {
      // fall through to heuristic
    }
  }

  // ---------- Heuristic fallback ----------
  const text = String(raw || '').toLowerCase();
  const words = new Set(text.split(/[^a-z0-9]+/).filter((w) => w.length > 3));

  const score = (blob) => {
    const ws = String(blob).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
    return ws.reduce((n, w) => n + (words.has(w) ? 1 : 0), 0);
  };

  let bestTag = 'P3';
  let bestScore = 0;
  for (const p of one_page.priorities || []) {
    const s = score(p.title + ' ' + (p.bullets || []).join(' '));
    if (s > bestScore) { bestScore = s; bestTag = p.code; }
  }
  const acclimWords = ['meet', 'relationship', 'culture', 'value', 'team', 'shadow', 'learn', 'listen', 'trust'];
  const track = acclimWords.some((w) => text.includes(w)) && bestScore === 0 ? 'acclimation' : 'impact';
  if (track === 'acclimation') {
    let bv = 'V3', bs = 0;
    for (const v of core_values) {
      const s = score(v.name + ' ' + v.description);
      if (s > bs) { bs = s; bv = v.code; }
    }
    bestTag = bv;
  }
  let phase = 60;
  if (/(map|learn|meet|shadow|review|assess|audit|understand)/.test(text)) phase = 30;
  if (/(document|automat|system|scale|launch|playbook|durable|repeatable)/.test(text)) phase = 90;

  return Response.json({
    source: 'heuristic',
    title: raw.length > 140 ? raw.slice(0, 137) + '…' : raw,
    phase,
    track,
    tags: [bestTag],
    success_measure: 'Define “done” together — reviewed and accepted at a weekly dialogue',
    rationale: 'Keyword match against the OnePage; add an Anthropic API key in Vercel for full AI structuring.',
  });
}
