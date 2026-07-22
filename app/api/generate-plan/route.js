// Auto-generates a starter 30/60/90 plan for a new employee from their role description,
// the shared Cardwell OnePage priorities, and the company values.
// Uses Claude when ANTHROPIC_API_KEY is set; otherwise a small heuristic starter set.
// Returns { items: [{ phase, track, tags, title, success_measure }] } — all start Not Started.

export async function POST(req) {
  const { role_title = '', role_description = '', one_page = {}, core_values = [] } = await req.json();
  const key = process.env.ANTHROPIC_API_KEY;

  if (key && (role_description || role_title)) {
    try {
      const prompt = `You are drafting a starter 30/60/90-day onboarding plan for a NEW leader at this organization.

Organization OnePage (strategy):
${JSON.stringify(one_page)}

Core values:
${JSON.stringify(core_values)}

New hire role title: ${role_title}
Role description:
"""
${String(role_description).slice(0, 4000)}
"""

Build a balanced draft plan. For EACH phase (30, then 60, then 90) include roughly 2-3 "impact" items
(tied to the strategic priorities) and 1-2 "acclimation" items (team, culture, values). ~12-15 items total.
Phase logic: 30 = learn/map/build relationships; 60 = own/operate; 90 = systemize/scale toward the pinnacle.
Return ONLY a JSON array, each object:
{
  "phase": 30 | 60 | 90,
  "track": "impact" | "acclimation",
  "tags": ["P1".."P4" and/or "V1".."V6" this item serves],
  "title": "clear, outcome-oriented item (max 140 chars)",
  "success_measure": "observable 'done means' statement (max 120 chars)"
}`;
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001', max_tokens: 3000, messages: [{ role: 'user', content: prompt }] }),
      });
      const j = await r.json();
      const out = j?.content?.[0]?.text || '';
      const m = out.match(/\[[\s\S]*\]/);
      if (m) { const arr = JSON.parse(m[0]); if (Array.isArray(arr) && arr.length) return Response.json({ source: 'ai', items: arr }); }
    } catch (e) {
      // fall through
    }
  }

  // ---------- Heuristic starter set (no API key) ----------
  const P = (one_page.priorities || []).map((p) => p.code);
  const p1 = P[0] || 'P1', p2 = P[1] || P[0] || 'P2';
  const items = [
    { phase: 30, track: 'acclimation', tags: ['V3'], title: 'Meet the team and key partners; map how the role connects to the strategy', success_measure: 'Stakeholder map reviewed with your leader' },
    { phase: 30, track: 'impact', tags: [p1], title: `Learn the current state of ${role_title || 'your area'} and where the friction is`, success_measure: 'Findings shared at a weekly dialogue' },
    { phase: 30, track: 'impact', tags: [p2], title: 'Identify the top priorities for your first 90 days with your leader', success_measure: 'Agreed priorities documented' },
    { phase: 60, track: 'impact', tags: [p1], title: `Take ownership of core ${role_title || 'area'} responsibilities`, success_measure: 'Running your areas without being chased' },
    { phase: 60, track: 'impact', tags: [p2], title: 'Establish the cadence of accountability for your commitments', success_measure: 'Weekly rhythm in place and visible' },
    { phase: 60, track: 'acclimation', tags: ['V2'], title: 'Build trust with the team through consistent follow-through', success_measure: 'Peer feedback gathered by your leader' },
    { phase: 90, track: 'impact', tags: [p1], title: 'Build something durable that moves the strategy toward the pinnacle', success_measure: 'A repeatable process or system others can use' },
    { phase: 90, track: 'impact', tags: [p2], title: 'Deliver a measurable result tied to a strategic priority', success_measure: 'Outcome reviewed and accepted' },
    { phase: 90, track: 'acclimation', tags: ['V1'], title: 'Propose an improvement to how the team works', success_measure: 'Idea discussed and a next step agreed' },
  ].map((i) => ({ ...i, success_measure: i.success_measure || 'Define “done” together at a weekly dialogue' }));

  return Response.json({ source: 'heuristic', items });
}
