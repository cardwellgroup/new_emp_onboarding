'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://siriqhbbkqehbetuorqd.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_wpZVrfJrgqiQhRI3arYeAg_YDhSqMxd';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PHASES = [
  { n: 30, name: 'Learn & Map', q: 'Do I understand the business, the team, and where the friction is?' },
  { n: 60, name: 'Own & Operate', q: 'Am I running my areas without being chased — and is anyone noticing?' },
  { n: 90, name: 'Systemize & Scale', q: 'Have I built things that outlast me and move the strategy?' },
];
const STATUSES = [
  ['not_started', 'Not started'],
  ['on_track', 'On track'],
  ['at_risk', 'At risk'],
  ['blocked', 'Blocked'],
  ['done', 'Done'],
];
const statusLabel = (s) => (STATUSES.find(([v]) => v === s) || [s, s])[1];

function mondayOf(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}
const fmtDate = (s) => (s ? new Date(s + (s.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const parseTags = (t) => (Array.isArray(t) ? t : String(t || '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean));

function tagTitle(code, org) {
  const op = org?.one_page || {};
  const p = (op.priorities || []).find((x) => x.code === code);
  if (p) return p.title;
  const v = (org?.core_values || []).find((x) => x.code === code);
  return v ? `${v.name} — ${v.description}` : code;
}

function Tag({ code, org }) {
  return (
    <span className={`tag ${code.startsWith('P') ? 'p' : 'v'}`} title={tagTitle(code, org)}>
      {code}
    </span>
  );
}

/* ---------- Login ---------- */
function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    setBusy(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <div className="center">
      <div className="login-wedge" />
      <div className="login-card">
        <div className="wordmark" style={{ color: 'var(--cw-navy)', marginBottom: 18 }}>
          CARDWELL <span className="chev" style={{ color: 'var(--cw-blue)' }}>»</span>
        </div>
        <h1>Leader Onboarding</h1>
        <p>Your 30/60/90 plan, aligned to the OnePage. Sign in with your work email — we&apos;ll send you a magic link.</p>
        {sent ? (
          <p style={{ color: 'var(--cw-navy)', fontWeight: 600 }}>
            Check your inbox — your sign-in link is on the way. You can close this tab.
          </p>
        ) : (
          <form onSubmit={send}>
            <input type="email" required placeholder="you@cardwellgroup.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn" disabled={busy || !email.includes('@')}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>
            {err && <p style={{ color: 'var(--cw-red)', marginTop: 10 }}>{err}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

/* ---------- Plan board ---------- */
function PlanBoard({ org, items, confMap, onStatus }) {
  const op = org?.one_page || {};
  return (
    <>
      <div className="onepage">
        <div className="small" style={{ opacity: 0.7, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {org?.name} OnePage · FY{op.fiscal_year}
        </div>
        <h2>{op.core_purpose}</h2>
        <div className="pinnacle">{op.pinnacle}</div>
        <div className="chips">
          {(op.priorities || []).map((p) => (
            <span key={p.code} className="chip p" title={(p.bullets || []).join(' · ')}>
              {p.code} · {p.title}
            </span>
          ))}
        </div>
        <div className="chips">
          {(org?.core_values || []).map((v) => (
            <span key={v.code} className="chip v" title={v.description}>
              {v.code} · {v.name}
            </span>
          ))}
        </div>
      </div>

      {PHASES.map((ph) => {
        const phItems = items.filter((i) => i.phase === ph.n);
        const done = phItems.filter((i) => i.status === 'done').length;
        const pct = phItems.length ? Math.round((done / phItems.length) * 100) : 0;
        return (
          <section className="phase" key={ph.n}>
            <div className="phase-head">
              <h3>Day {ph.n === 30 ? '1–30' : ph.n === 60 ? '31–60' : '61–90'} · {ph.name}</h3>
              <span className="q">{ph.q}</span>
              <span className="small muted" style={{ marginLeft: 'auto' }}>{done}/{phItems.length} done</span>
            </div>
            <div className="progress"><div style={{ width: `${pct}%` }} /></div>
            <div className="tracks">
              {['impact', 'acclimation'].map((tr) => (
                <div className="track" key={tr}>
                  <h4>{tr === 'impact' ? 'Impact — strategic priorities' : 'Acclimation — team, culture & values'}</h4>
                  {phItems.filter((i) => i.track === tr).map((i) => (
                    <div className="card" key={i.id}>
                      <div className="title">
                        {i.phase_critical && <span className="crit" title="Phase-critical">★ </span>}
                        {i.title}
                      </div>
                      <div className="measure"><b>Done means:</b> {i.success_measure}</div>
                      {i.evidence && <div className="measure"><b>Evidence:</b> {i.evidence}</div>}
                      <div className="card-foot">
                        {i.tags.map((t) => <Tag key={t} code={t} org={org} />)}
                        <span className={`status ${i.status}`}>{statusLabel(i.status)}</span>
                        {confMap[i.id] != null && <span className="conf">confidence {confMap[i.id]}/5</span>}
                        <select
                          value={i.status}
                          onChange={(e) => onStatus(i, e.target.value)}
                          style={{ marginLeft: 'auto' }}
                          aria-label="Update status"
                        >
                          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

/* ---------- Weekly check-in (employee) ---------- */
function CheckinTab({ plan, items, cks, reload }) {
  const week = mondayOf(new Date());
  const existing = cks.find((c) => c.week_of === week);
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState(false);
  const active = items.filter((i) => i.status !== 'done');

  useEffect(() => {
    const init = {};
    for (const i of active) {
      const prev = existing?.check_in_items?.find((r) => r.plan_item_id === i.id);
      init[i.id] = prev
        ? { status: prev.status, confidence: prev.confidence || 3, note: prev.note || '', shared: prev.shared }
        : { status: i.status === 'not_started' ? 'not_started' : i.status, confidence: 3, note: '', shared: true };
    }
    setRows(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, existing?.id]);

  function set(id, k, v) {
    setRows((r) => ({ ...r, [id]: { ...r[id], [k]: v } }));
  }

  async function save(submit) {
    setSaving(true);
    let ck = existing;
    if (!ck) {
      const { data, error } = await supabase
        .from('check_ins')
        .upsert({ plan_id: plan.id, week_of: week }, { onConflict: 'plan_id,week_of' })
        .select()
        .single();
      if (error) { alert(error.message); setSaving(false); return; }
      ck = data;
    }
    const payload = Object.entries(rows).map(([plan_item_id, r]) => ({
      check_in_id: ck.id,
      plan_item_id,
      status: r.status,
      confidence: r.confidence,
      note: r.note || null,
      shared: r.shared,
    }));
    let { error } = await supabase.from('check_in_items').upsert(payload, { onConflict: 'check_in_id,plan_item_id' });
    if (!error && submit) {
      ({ error } = await supabase.from('check_ins').update({ submitted_at: new Date().toISOString() }).eq('id', ck.id));
      if (!error) {
        for (const [id, r] of Object.entries(rows)) {
          await supabase.from('plan_items').update({ status: r.status }).eq('id', id);
        }
      }
    }
    setSaving(false);
    if (error) alert(error.message);
    else { alert(submit ? 'Check-in submitted. It will appear in your manager’s dialogue prep.' : 'Draft saved.'); reload(); }
  }

  return (
    <div className="panel">
      <h3>Weekly check-in · week of {fmtDate(week)}</h3>
      <p className="sub">
        Due EOD Wednesday — same beat as project updates in Connections. Status + confidence takes two minutes.
        Notes marked “share” appear in {plan.manager_name?.split(' ')[0] || 'your manager'}&apos;s dialogue prep; unshared notes stay yours.
        {existing?.submitted_at && <b> Submitted {fmtDate(existing.submitted_at.slice(0, 10))} — you can update and resubmit.</b>}
      </p>
      {active.map((i) => {
        const r = rows[i.id];
        if (!r) return null;
        return (
          <div className="ci-row" key={i.id}>
            <div className="ci-title">{i.phase_critical ? '★ ' : ''}{i.title} <span className="small muted">· Day {i.phase}</span></div>
            <div className="ci-controls">
              <select value={r.status} onChange={(e) => set(i.id, 'status', e.target.value)}>
                {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select value={r.confidence} onChange={(e) => set(i.id, 'confidence', +e.target.value)}>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Confidence {n}/5</option>)}
              </select>
              <textarea rows={1} placeholder="Note (optional)" value={r.note} onChange={(e) => set(i.id, 'note', e.target.value)} />
              <label className="share-toggle">
                <input type="checkbox" checked={r.shared} onChange={(e) => set(i.id, 'shared', e.target.checked)} /> share
              </label>
            </div>
          </div>
        );
      })}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn ghost" disabled={saving} onClick={() => save(false)}>Save draft</button>
        <button className="btn" disabled={saving} onClick={() => save(true)}>{saving ? 'Saving…' : 'Submit check-in'}</button>
      </div>
    </div>
  );
}

/* ---------- Dialogue prep (manager) ---------- */
function PrepTab({ plan, items, cks }) {
  const latest = cks.find((c) => c.submitted_at);
  if (!latest) {
    return (
      <div className="panel">
        <h3>Dialogue prep</h3>
        <p className="sub">No submitted check-ins yet. Once {plan.employee_name?.split(' ')[0] || 'your new leader'} submits a Wednesday check-in, this view assembles itself before your weekly dialogue.</p>
      </div>
    );
  }
  const byItem = Object.fromEntries((latest.check_in_items || []).map((r) => [r.plan_item_id, r]));
  const rows = items.map((i) => ({ item: i, ci: byItem[i.id] })).filter((x) => x.ci);
  const flags = rows.filter((x) => ['at_risk', 'blocked'].includes(x.ci.status));
  const sharedNotes = rows.filter((x) => x.ci.shared && x.ci.note);
  const confs = rows.map((x) => x.ci.confidence).filter(Boolean);
  const avgConf = confs.length ? (confs.reduce((a, b) => a + b, 0) / confs.length).toFixed(1) : '—';
  const done = items.filter((i) => i.status === 'done').length;

  return (
    <>
      <div className="panel">
        <h3>Dialogue prep · check-in week of {fmtDate(latest.week_of)}</h3>
        <p className="sub">Celebrate, unblock, refocus — in that order.</p>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <div className="stat"><div className="n">{done}/{items.length}</div><div className="l">items done</div></div>
          <div className="stat"><div className="n">{avgConf}</div><div className="l">avg confidence</div></div>
          <div className="stat"><div className="n">{flags.length}</div><div className="l">flags</div></div>
        </div>
      </div>

      {flags.length > 0 && (
        <div className="panel">
          <h3>Unblock first</h3>
          {flags.map(({ item, ci }) => (
            <div className={`flag ${ci.status === 'at_risk' ? 'amber' : ''}`} key={item.id}>
              <b>{statusLabel(ci.status)}:</b> {item.title}
              {ci.shared && ci.note ? <div className="small muted" style={{ marginTop: 4 }}>“{ci.note}”</div> : null}
            </div>
          ))}
        </div>
      )}

      <div className="panel">
        <h3>Shared notes</h3>
        {sharedNotes.length === 0 && <p className="sub">No shared notes this week.</p>}
        {sharedNotes.map(({ item, ci }) => (
          <div className="journal-note" key={item.id}>
            <div className="date">{item.title} · {statusLabel(ci.status)} · confidence {ci.confidence}/5</div>
            {ci.note}
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Add to plan (ad hoc, AI-structured) ---------- */
function AddTab({ plan, org, isManager, email, reqs, reload }) {
  const [raw, setRaw] = useState('');
  const [sug, setSug] = useState(null);
  const [busy, setBusy] = useState(false);

  async function suggest() {
    setBusy(true);
    try {
      const r = await fetch('/api/structure', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ raw, one_page: org.one_page, core_values: org.core_values, role_title: plan.role_title }),
      });
      const j = await r.json();
      setSug({ ...j, tags: parseTags(j.tags).join(', ') });
    } catch {
      alert('Could not generate a suggestion — try again.');
    }
    setBusy(false);
  }

  async function commit() {
    const item = {
      plan_id: plan.id,
      phase: +sug.phase,
      track: sug.track,
      tags: parseTags(sug.tags),
      title: sug.title,
      success_measure: sug.success_measure,
      source: isManager ? 'manager_added' : 'employee_proposed',
      created_by: email,
    };
    if (isManager) {
      const { data, error } = await supabase.from('plan_items').insert(item).select().single();
      if (error) return alert(error.message);
      await supabase.from('ad_hoc_requests').insert({
        plan_id: plan.id, raw_text: raw, ai_suggestion: sug, status: 'approved',
        requested_by: email, approved_by: email, resolved_item_id: data.id,
      });
    } else {
      const { error } = await supabase.from('ad_hoc_requests').insert({
        plan_id: plan.id, raw_text: raw, ai_suggestion: sug, requested_by: email,
      });
      if (error) return alert(error.message);
    }
    setRaw(''); setSug(null); reload();
  }

  async function resolve(req, approve) {
    if (approve) {
      const s = req.ai_suggestion || {};
      const { data, error } = await supabase.from('plan_items').insert({
        plan_id: plan.id,
        phase: +(s.phase || 60),
        track: s.track || 'impact',
        tags: parseTags(s.tags),
        title: s.title || req.raw_text.slice(0, 140),
        success_measure: s.success_measure || 'Define “done” together at the next dialogue',
        source: 'employee_proposed',
        created_by: req.requested_by,
      }).select().single();
      if (error) return alert(error.message);
      await supabase.from('ad_hoc_requests').update({ status: 'approved', approved_by: email, resolved_item_id: data.id }).eq('id', req.id);
    } else {
      await supabase.from('ad_hoc_requests').update({ status: 'rejected', approved_by: email }).eq('id', req.id);
    }
    reload();
  }

  return (
    <>
      <div className="panel">
        <h3>Add to the plan</h3>
        <p className="sub">
          Describe a project, focus area, or relationship in plain language. The tool structures it against the
          OnePage priorities and values at the time of onboarding — you approve before it lands in the plan.
        </p>
        <textarea rows={3} placeholder="e.g., Take over coordination of the monthly Sypher delivery-credit review" value={raw} onChange={(e) => setRaw(e.target.value)} />
        <div className="row" style={{ marginTop: 10 }}>
          <button className="btn" disabled={busy || raw.trim().length < 8} onClick={suggest}>{busy ? 'Structuring…' : 'Structure it'}</button>
        </div>

        {sug && (
          <div style={{ marginTop: 18, borderTop: '1px solid var(--cw-gray-light)', paddingTop: 16 }}>
            <p className="small muted" style={{ marginBottom: 10 }}>
              Suggested by {sug.source === 'ai' ? 'AI against the current OnePage' : 'keyword matching (connect an Anthropic API key for full AI structuring)'} — edit anything before adding.
            </p>
            <div className="field"><label>Title</label><input value={sug.title} onChange={(e) => setSug({ ...sug, title: e.target.value })} /></div>
            <div className="row">
              <div className="field"><label>Phase</label>
                <select value={sug.phase} onChange={(e) => setSug({ ...sug, phase: e.target.value })}>
                  <option value="30">Day 1–30</option><option value="60">Day 31–60</option><option value="90">Day 61–90</option>
                </select>
              </div>
              <div className="field"><label>Track</label>
                <select value={sug.track} onChange={(e) => setSug({ ...sug, track: e.target.value })}>
                  <option value="impact">Impact</option><option value="acclimation">Acclimation</option>
                </select>
              </div>
              <div className="field" style={{ flex: 1 }}><label>Tags (P1–P4, V1–V6)</label>
                <input value={sug.tags} onChange={(e) => setSug({ ...sug, tags: e.target.value })} />
              </div>
            </div>
            <div className="field"><label>Done means</label><input value={sug.success_measure} onChange={(e) => setSug({ ...sug, success_measure: e.target.value })} /></div>
            {sug.rationale && <p className="small muted" style={{ marginBottom: 10 }}>Why: {sug.rationale}</p>}
            <button className="btn navy" onClick={commit}>{isManager ? 'Add to plan' : 'Submit for approval'}</button>
          </div>
        )}
      </div>

      <div className="panel">
        <h3>Requests</h3>
        <p className="sub">{isManager ? 'Employee-proposed items awaiting your call.' : 'Your proposals and where they stand.'}</p>
        {reqs.length === 0 && <p className="sub">Nothing here yet.</p>}
        {reqs.map((r) => (
          <div className="req" key={r.id}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="pill" style={{ display: 'none' }} />
              <div className="raw"><b>{r.ai_suggestion?.title || r.raw_text}</b></div>
              <span className={`pill ${r.status}`}>{r.status}</span>
            </div>
            <div className="small muted">
              {r.raw_text} · requested by {r.requested_by} · {fmtDate(r.created_at?.slice(0, 10))}
            </div>
            {isManager && r.status === 'pending' && (
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn" onClick={() => resolve(r, true)}>Approve → add to plan</button>
                <button className="btn ghost" onClick={() => resolve(r, false)}>Decline</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- Journal ---------- */
function JournalTab({ plan, email, entries, reload }) {
  const [body, setBody] = useState('');
  async function add() {
    const { error } = await supabase.from('journal_entries').insert({ plan_id: plan.id, author_email: email, body });
    if (error) return alert(error.message);
    setBody(''); reload();
  }
  return (
    <div className="panel">
      <h3>Private journal</h3>
      <p className="sub">Only you can ever read this — it is enforced at the database level, not just hidden. Use it to think out loud; share the polished version in a check-in when you&apos;re ready.</p>
      <textarea rows={4} placeholder="What's actually going on this week…" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="row" style={{ margin: '10px 0 20px' }}>
        <button className="btn" disabled={body.trim().length < 2} onClick={add}>Save entry</button>
      </div>
      {entries.map((e) => (
        <div className="journal-note" key={e.id}>
          <div className="date">{new Date(e.created_at).toLocaleString()}</div>
          {e.body}
        </div>
      ))}
    </div>
  );
}

/* ---------- App shell ---------- */
function App({ session }) {
  const email = session.user.email.toLowerCase();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('plan');

  async function load() {
    const { data: plans, error } = await supabase.from('plans').select('*, organizations(*)');
    if (error) return setErr(error.message);
    const plan = plans?.[0];
    if (!plan) return setErr('No onboarding plan is linked to this email yet.');
    const [items, cks, reqs, journal] = await Promise.all([
      supabase.from('plan_items').select('*').eq('plan_id', plan.id).order('phase').order('sort_order'),
      supabase.from('check_ins').select('*, check_in_items(*)').eq('plan_id', plan.id).order('week_of', { ascending: false }),
      supabase.from('ad_hoc_requests').select('*').eq('plan_id', plan.id).order('created_at', { ascending: false }),
      supabase.from('journal_entries').select('*').eq('plan_id', plan.id).order('created_at', { ascending: false }),
    ]);
    setData({ plan, org: plan.organizations, items: items.data || [], cks: cks.data || [], reqs: reqs.data || [], journal: journal.data || [] });
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className="center"><p style={{ color: 'var(--cw-red)' }}>{err}</p><button className="btn ghost" onClick={() => supabase.auth.signOut()}>Sign out</button></div>;
  if (!data) return <div className="center muted">Loading your plan…</div>;

  const { plan, org, items, cks, reqs, journal } = data;
  const isManager = email === plan.manager_email.toLowerCase();
  const latest = cks.find((c) => c.submitted_at);
  const confMap = Object.fromEntries((latest?.check_in_items || []).map((r) => [r.plan_item_id, r.confidence]));
  const isWed = new Date().getDay() === 3;
  const thisWeekSubmitted = cks.some((c) => c.week_of === mondayOf(new Date()) && c.submitted_at);

  async function onStatus(item, status) {
    let evidence = item.evidence;
    if (status === 'done' && !evidence) {
      evidence = window.prompt(`Marking done. What's the evidence against the success measure?\n\n"${item.success_measure}"`);
      if (evidence === null) return;
    }
    const { error } = await supabase.from('plan_items').update({ status, evidence }).eq('id', item.id);
    if (error) alert(error.message); else load();
  }

  const tabs = [
    ['plan', '30/60/90 Plan'],
    isManager ? ['prep', 'Dialogue Prep'] : ['checkin', 'Weekly Check-in'],
    ['add', 'Add to Plan'],
    ['journal', 'Journal'],
  ];

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div>
            <div className="wordmark">CARDWELL <span className="chev">»</span></div>
            <div className="app-title">Leader Onboarding · {plan.employee_name} · {plan.role_title} · started {fmtDate(plan.start_date)}</div>
          </div>
          <div className="userchip">
            <span className="role">{isManager ? 'Leader view' : 'New leader view'}</span>
            <span>{email}</span>
            <button className="signout" onClick={() => supabase.auth.signOut()}>Sign out</button>
          </div>
        </div>
      </header>
      <main className="wrap">
        {!isManager && isWed && !thisWeekSubmitted && (
          <div className="banner">Check-in due today — EOD Wednesday, same rhythm as Connections. Two minutes, real signal.</div>
        )}
        <nav className="tabs">
          {tabs.map(([k, l]) => (
            <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
        {tab === 'plan' && <PlanBoard org={org} items={items} confMap={confMap} onStatus={onStatus} />}
        {tab === 'checkin' && !isManager && <CheckinTab plan={plan} items={items} cks={cks} reload={load} />}
        {tab === 'prep' && isManager && <PrepTab plan={plan} items={items} cks={cks} />}
        {tab === 'add' && <AddTab plan={plan} org={org} isManager={isManager} email={email} reqs={reqs} reload={load} />}
        {tab === 'journal' && <JournalTab plan={plan} email={email} entries={journal} reload={load} />}
      </main>
    </>
  );
}

export default function Home() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <div className="center muted">Loading…</div>;
  if (!session) return <Login />;
  return <App session={session} />;
}
