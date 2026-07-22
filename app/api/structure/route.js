// Structures one or more listed items into full 30/60/90 plan-item templates.
// The user may list several things (numbered or one per line); we return an item per line.
// Uses Claude when ANTHROPIC_API_KEY is set; otherwise a keyword heuristic fallback.

export async function POST(req) {
  const { raw, one_page = {}, core_values = [], role_title = '' } = await req.json();
  const key = process.env.ANTHROPIC_API_KEY;
  const input = String(raw || '').trim();

  if (key && input.length > 3) {
    try {
      const prompt = `You structure onboarding items for a new leader's 30/60/90 plan.

Organization OnePage:
${JSON.stringify(one_page)}

Core values:
${JSON.stringify(core_values)}

New leader's role: ${role_title}

The user listed one or more things to add to the plan (they may be numbered or one per line):
"""
${input.slice(0, 6000)}
"""

Create ONE structured plan item for EACH distinct thing listed, in the order listed.
Fill EVERY field of the template as completely as you can.
Return ONLY a JSON array, one object per item:
[{
  "title": "clear, outcome-oriented restatement (max 140 chars)",
  "phase": 30 | 60 | 90,
  "track": "impact" | "acclimation",
  "tags": ["P1".."P4" and/or "V1".."V6" — every priority/value it genuinely serves],
  "success_measure": "concrete, observable 'done means' statement (max 120 chars)",
  "rationale": "one sentence on why this phase and these tags"
}]
Phase logic: learning/mapping/relationship-building -> 30; owning/operating -> 60; systemizing/documenting/scaling -> 90.`;

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
          max_tokens: 2000,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const j = await r.json();
      const out = j?.content?.[0]?.text || '';
      const m = out.match(/\[[\s\S]*\]/);
      if (m) {
        const arr = JSON.parse(m[0]);
        if (Array.isArray(arr) && arr.length) return Response.json({ source: 'ai', items: arr });
      }
    } catch (e) {
      // fall through to heuristic
    }
  }

  // ---------- Heuristic fallback: one item per listed line ----------
  const lines = input.split(/\n+/).map((l) => l.replace(/^[\s\-*•\d.)]+/, '').trim()).filter((l) => l.length > 3);
  const list = lines.length ? lines : [input].filter(Boolean);
  const items = list.map((line) => {
    const text = line.toLowerCase();
    const words = new Set(text.split(/[^a-z0-9]+/).filter((w) => w.length > 3));
    const score = (b) => String(b).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3).reduce((n, w) => n + (words.has(w) ? 1 : 0), 0);
    let bestTag = 'P3', bestScore = 0;
    for (const p of one_page.priorities || []) { const s = score(p.title + ' ' + (p.bullets || []).join(' ')); if (s > bestScore) { bestScore = s; bestTag = p.code; } }
    const acclim = ['meet', 'relationship', 'culture', 'value', 'team', 'shadow', 'learn', 'listen', 'trust'];
    const track = acclim.some((w) => text.includes(w)) && bestScore === 0 ? 'acclimation' : 'impact';
    let tag = bestTag;
    if (track === 'acclimation') { let bv = 'V3', bs = 0; for (const v of core_values) { const s = score(v.name + ' ' + v.description); if (s > bs) { bs = s; bv = v.code; } } tag = bv; }
    let phase = 60;
    if (/(map|learn|meet|shadow|review|assess|audit|understand)/.test(text)) phase = 30;
    if (/(document|automat|system|scale|launch|playbook|durable|repeatable)/.test(text)) phase = 90;
    return {
      title: line.length > 140 ? line.slice(0, 137) + '…' : line,
      phase, track, tags: [tag],
      success_measure: 'Define “done” together at a weekly dialogue',
      rationale: 'Keyword match against the OnePage; add ANTHROPIC_API_KEY for full AI structuring.',
    };
  });

  return Response.json({ source: 'heuristic', items });
}
