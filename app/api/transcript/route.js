// Turns a meeting transcript (e.g. pasted from Fireflies) or a meeting link into a set of
// candidate 30/60/90 plan items, structured against the OnePage priorities and core values.
// Uses Claude when ANTHROPIC_API_KEY is set; otherwise a light heuristic fallback.
// NOTE: We do not fetch external meeting URLs server-side (Fireflies share links are auth-gated
// and vary). Paste the transcript text; the url is stored on the request only as a reference.

export async function POST(req) {
  const { transcript = '', url = '', one_page = {}, core_values = [], role_title = '' } = await req.json();
  const key = process.env.ANTHROPIC_API_KEY;
  const text = String(transcript || '').trim();

  if (key && text.length > 20) {
    try {
      const prompt = `You extract onboarding plan items for a new leader's 30/60/90 plan from a meeting transcript.

Organization OnePage:
${JSON.stringify(one_page)}

Core values:
${JSON.stringify(core_values)}

New leader's role: ${role_title}

Meeting transcript:
"""
${text.slice(0, 12000)}
"""

Identify concrete commitments, projects, focus areas, or follow-ups that belong in the plan.
Return ONLY a JSON array (no prose), 1-8 objects, each:
{
  "title": "outcome-oriented restatement (max 140 chars)",
  "phase": 30 | 60 | 90,
  "track": "impact" | "acclimation",
  "tags": ["P1".."P4" and/or "V1".."V6" — the priorities/values this serves, 1-3 tags],
  "success_measure": "concrete 'done means' statement, observable, max 120 chars",
  "rationale": "one sentence"
}
Phase logic: learning/mapping/relationship-building -> 30; owning/operating -> 60; systemizing/documenting/scaling -> 90.
Only include items that are real action items or ownership areas, not small talk.`;

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const j = await r.json();
      const out = j?.content?.[0]?.text || '';
      const match = out.match(/\[[\s\S]*\]/);
      if (match) {
        const arr = JSON.parse(match[0]);
        return Response.json({ source: 'ai', url, items: Array.isArray(arr) ? arr : [] });
      }
    } catch (e) {
      // fall through
    }
  }

  // ---------- Heuristic fallback: pull imperative-ish lines ----------
  const lines = text
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((l) => l.length > 12 && l.length < 200);
  const verbs = /(own|lead|build|launch|map|meet|review|document|set up|create|define|deliver|coordinate|drive|establish|automate|scale)/i;
  const picks = lines.filter((l) => verbs.test(l)).slice(0, 6);
  const items = (picks.length ? picks : lines.slice(0, 4)).map((l) => ({
    title: l.length > 140 ? l.slice(0, 137) + '…' : l,
    phase: /(document|automate|system|scale|launch|playbook)/i.test(l) ? 90 : /(map|learn|meet|review|assess)/i.test(l) ? 30 : 60,
    track: /(meet|relationship|culture|value|team|trust|listen)/i.test(l) ? 'acclimation' : 'impact',
    tags: [],
    success_measure: 'Define “done” together at the next dialogue',
    rationale: 'Extracted from the transcript by keyword (add ANTHROPIC_API_KEY for full AI extraction).',
  }));

  return Response.json({ source: 'heuristic', url, items });
}
