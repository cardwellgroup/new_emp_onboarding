'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://siriqhbbkqehbetuorqd.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_wpZVrfJrgqiQhRI3arYeAg_YDhSqMxd';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const PHASES = [
  { n: 30, name: 'Learn & Map', range: 'Day 1–30', q: 'Do I understand the business, the team, and where the friction is?' },
  { n: 60, name: 'Own & Operate', range: 'Day 31–60', q: 'Am I running my areas with the right Commitments and established the Cadence of Accountability?' },
  { n: 90, name: 'Systemize & Scale', range: 'Day 61–90', q: 'Have I built value and moved our strategy forward towards the Pinnacle?' },
];
const phaseLabel = (n) => { const p = PHASES.find((x) => x.n === n); return p ? `${p.range} · ${p.name}` : `Day ${n}`; };
const STATUSES = [
  ['not_started', 'Not started'],
  ['on_track', 'On track'],
  ['at_risk', 'At risk'],
  ['blocked', 'Blocked'],
  ['done', 'Done'],
];
const statusLabel = (s) => (STATUSES.find(([v]) => v === s) || [s, s])[1];

const fmtDate = (s) => (s ? new Date(s + (s.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const fmtWhen = (s) => (s ? new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
function mondayOf(d) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x.toISOString().slice(0, 10); }
const parseTags = (t) => (Array.isArray(t) ? t : String(t || '').split(',').map((x) => x.trim().toUpperCase()).filter(Boolean));
const eq = (a, b) => (a || '').toLowerCase() === (b || '').toLowerCase();

/* ---------- Phase date math (items 1-2): plan_start_date anchors the 30/60/90 windows.
   day_mode 'business' counts M-F only; 'calendar' counts every day. ---------- */
function addPlanDays(startStr, n, mode) {
  if (!startStr) return null;
  const d = new Date(startStr + 'T12:00:00');
  if (mode === 'business') {
    let left = n;
    while (left > 0) { d.setDate(d.getDate() + 1); const dow = d.getDay(); if (dow !== 0 && dow !== 6) left--; }
  } else {
    d.setDate(d.getDate() + n);
  }
  return d;
}
function phaseEndLabel(plan, n) {
  const start = plan?.plan_start_date || plan?.start_date;
  if (!start) return '';
  const d = addPlanDays(start, n, plan?.day_mode || 'calendar');
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
}

/* ---------- Autosave drafts (item 5): values persist locally until the final save. ---------- */
function draftGet(key) { try { return localStorage.getItem('cw_draft_' + key) || ''; } catch { return ''; } }
function draftSet(key, val) { try { if (val) localStorage.setItem('cw_draft_' + key, val); else localStorage.removeItem('cw_draft_' + key); } catch {} }
function draftClear(...keys) { try { keys.forEach((k) => localStorage.removeItem('cw_draft_' + k)); } catch {} }

/* ---------- Item ordering (items 7-8): starred first (fixed, by ref), then sort_order. ---------- */
function orderItems(list) {
  return [...list].sort((a, b) => {
    if (!!b.phase_critical - !!a.phase_critical) return (!!b.phase_critical ? 1 : 0) - (!!a.phase_critical ? 1 : 0);
    if (a.phase_critical && b.phase_critical) return (a.ref_no || 0) - (b.ref_no || 0);
    return (a.sort_order || 0) - (b.sort_order || 0) || (a.ref_no || 0) - (b.ref_no || 0);
  });
}

function priorityCodes(org) { return (org?.one_page?.priorities || []).map((p) => p.code); }
function valueCodes(org) { return (org?.core_values || []).map((v) => v.code); }
function tagTitle(code, org) {
  const p = (org?.one_page?.priorities || []).find((x) => x.code === code);
  if (p) return p.title;
  const v = (org?.core_values || []).find((x) => x.code === code);
  return v ? `${v.name} — ${v.description}` : code;
}
function Tag({ code, org }) {
  return <span className={`tag ${code.startsWith('P') ? 'p' : 'v'}`} title={tagTitle(code, org)}>{code}</span>;
}

/* ---------- Logo ----------
   Pulls Cardwell's official logo from the cardwellgroup.com CDN at runtime.
   Falls back to an inline navy-C + blue-chevron mark if the image can't load
   (offline, CDN change). To self-host, drop a PNG/SVG in /public and point
   LOGO_DARK / LOGO_WHITE at e.g. '/cardwell-logo.svg'. */
const LOGO_DARK = 'https://cdn.prod.website-files.com/6983d1ec7492b7a648ada6e5/699ded4aa51224e86cc16ecf_Group%204%20(3).svg';
const LOGO_WHITE = 'https://cdn.prod.website-files.com/6983d1ec7492b7a648ada6e5/69a0ac693c61e064ff07435f_white-logo%20(1).png';

function LogoMark({ size = 26, light = false }) {
  const c = light ? '#ffffff' : '#00007b';
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-label="Cardwell">
      <path d="M31 9.5A15 15 0 1 0 31 30.5" fill="none" stroke={c} strokeWidth="6" strokeLinecap="round" />
      <path d="M22 13l8 7-8 7" fill="none" stroke="#3b7cff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Logo({ light = false }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span className="logo">
        <LogoMark light={light} />
        <span className="wm" style={{ color: light ? '#fff' : 'var(--cw-navy)' }}>CARDWELL</span>
      </span>
    );
  }
  return (
    <span className="logo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={light ? LOGO_WHITE : LOGO_DARK} alt="Cardwell" style={{ height: 28, width: 'auto', display: 'block' }} onError={() => setFailed(true)} />
    </span>
  );
}

/* ---------- Speech-to-text (item 9) ---------- */
function useDictation(onText) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  function toggle() {
    const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { alert('Voice input needs Chrome or Safari on this device.'); return; }
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SR();
    rec.lang = 'en-US'; rec.interimResults = false; rec.continuous = false;
    rec.onresult = (e) => { const t = Array.from(e.results).map((r) => r[0].transcript).join(' '); onText(t); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec; setListening(true); rec.start();
  }
  return { listening, toggle };
}
function Mic({ onText }) {
  const { listening, toggle } = useDictation(onText);
  return <button type="button" className={`mic ${listening ? 'live' : ''}`} onClick={toggle} title="Dictate" aria-label="Dictate">🎤</button>;
}

/* ---------- Login ---------- */
function Login() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function send(e) {
    e.preventDefault(); setBusy(true); setErr('');
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined },
    });
    setBusy(false);
    if (error) setErr(error.message); else setSent(true);
  }
  return (
    <div className="center">
      <div className="login-wedge" />
      <div className="login-card">
        <Logo />
        <h1>Leader Onboarding</h1>
        <p>Your 30/60/90 plan, aligned to the OnePage. Sign in with your work email — we&apos;ll send you a magic link.</p>
        {sent ? (
          <p style={{ color: 'var(--cw-navy)', fontWeight: 600 }}>Check your inbox — your sign-in link is on the way.</p>
        ) : (
          <form onSubmit={send}>
            <input type="email" required placeholder="you@cardwellgroup.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn" disabled={busy || !email.includes('@')}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
            {err && <p style={{ color: 'var(--cw-red)', marginTop: 10 }}>{err}</p>}
          </form>
        )}
      </div>
    </div>
  );
}

/* ---------- Item flag helpers (items 10 & 12) ---------- */
function flagFor(item, acks, email) {
  const a = acks.find((x) => x.plan_item_id === item.id && eq(x.user_email, email));
  if (!a) return 'new';
  if ((a.ack_version ?? 0) < (item.content_version ?? 1)) return 'edited';
  return null;
}

/* ---------- Item tile (simplified; click opens the detail drawer — item 4) ---------- */
function ItemTile({ item, flag, onOpen, draggable, onDragStart, onDragOver, onDrop }) {
  return (
    <div
      className={`card tile ${flag === 'new' ? 'is-new' : ''} ${flag === 'edited' ? 'is-edited' : ''} ${draggable ? 'draggable' : ''}`}
      onClick={() => onOpen(item)}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="title">
        <span className="refno">#{item.ref_no || '–'}</span>
        {item.phase_critical && <span className="startag on" title="Priority for this phase">★</span>}
        <span className="txt">{item.title}</span>
        {flag === 'new' && <span className="newchip">NEW</span>}
        {flag === 'edited' && <span className="editedchip">UPDATED</span>}
        {item.pending_edit && <span className="pendchip" title="Edit awaiting leader approval">APPROVAL PENDING</span>}
        <span className={`status ${item.status}`}>{statusLabel(item.status)}</span>
      </div>
    </div>
  );
}

/* ---------- Detail drawer (progressive disclosure, slides from the right) ---------- */
function ItemDrawer({ item, org, plan, email, isManager, flag, comments, handlers, onClose }) {
  const [editing, setEditing] = useState(false);
  const [editNote, setEditNote] = useState('');
  const [denyNote, setDenyNote] = useState('');
  if (!item) return null;
  const canDelete = isManager || eq(item.created_by, email);
  const isOwn = eq(item.created_by, email);
  const itemComments = comments.filter((c) => c.plan_item_id === item.id);
  const pe = item.pending_edit;
  return (
    <>
      <div className="drawer-back" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head">
          <span className="refno big">#{item.ref_no || '–'}</span>
          {item.phase_critical && <span className="startag on">★</span>}
          <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <h3 className="drawer-title">{item.title}</h3>
        <div className="small muted" style={{ marginBottom: 10 }}>{phaseLabel(item.phase)} · {item.track === 'impact' ? 'Impact' : 'Acclimation'}{item.created_by ? ` · added by ${item.created_by}` : ''}</div>

        {pe && (
          <div className="pending-box">
            <b>Edit awaiting leader approval</b>
            <div className="small" style={{ marginTop: 4 }}>Requested by {pe.requested_by}{pe.comment ? ` — “${pe.comment}”` : ''}</div>
            {isManager && (
              <div style={{ marginTop: 8 }}>
                <input placeholder="Optional comment if declining…" value={denyNote} onChange={(e) => setDenyNote(e.target.value)} style={{ width: '100%', marginBottom: 8 }} />
                <div className="row">
                  <button className="btn sm" onClick={() => handlers.onResolveEdit(item, true, '')}>Approve edit</button>
                  <button className="btn ghost sm" onClick={() => handlers.onResolveEdit(item, false, denyNote.trim())}>Decline &amp; revert</button>
                </div>
              </div>
            )}
          </div>
        )}

        {!editing ? (
          <>
            <div className="field"><label>Status</label>
              <div className="row">
                <span className={`status ${item.status}`}>{statusLabel(item.status)}</span>
                <select value={item.status} onChange={(e) => handlers.onStatus(item, e.target.value)} aria-label="Update status">
                  {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="field"><label>Aligned to</label>
              <div className="row">{(item.tags || []).length ? (item.tags || []).map((t) => <Tag key={t} code={t} org={org} />) : <span className="small muted">No tags</span>}</div>
            </div>
            <div className="field"><label>Done means</label><div className="drawer-text">{item.success_measure}</div></div>
            {item.evidence && <div className="field"><label>Evidence</label><div className="drawer-text">{item.evidence}</div></div>}
            <div className="row" style={{ margin: '6px 0 14px' }}>
              {flag && <button className="ackbtn" onClick={() => handlers.onAck(item)}>Got it</button>}
              <button className={`iconbtn ${item.phase_critical ? '' : ''}`} onClick={() => handlers.onTogglePriority(item)}>{item.phase_critical ? '★ Unstar' : '☆ Star as priority'}</button>
              <button className="iconbtn" onClick={() => setEditing(true)}>✎ Edit</button>
              {canDelete && <button className="iconbtn danger" onClick={() => handlers.onDelete(item)}>🗑 Delete</button>}
            </div>
          </>
        ) : (
          <>
            {!isManager && !isOwn && (
              <div className="field"><label>Note to your leader (optional — this edit needs approval)</label>
                <input value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Why the change…" />
              </div>
            )}
            <ItemForm org={org} initial={item} onCancel={() => setEditing(false)}
              onSubmit={async (patch) => { const ok = await handlers.onSave(item, patch, editNote.trim()); if (ok) { setEditing(false); setEditNote(''); } return ok; }}
              submitLabel={!isManager && !isOwn ? 'Save (sends for approval)' : 'Save changes'} />
          </>
        )}

        <div className="field"><label>Comments</label></div>
        <CommentThread item={item} email={email} comments={itemComments} onComment={handlers.onComment} onDeleteComment={handlers.onDeleteComment} isManager={isManager} />
      </aside>
    </>
  );
}

function CommentThread({ item, email, comments, onComment, onDeleteComment, isManager }) {
  const dk = `cm_${item.id}`;
  const [body, setBodyState] = useState(() => draftGet(dk));
  const setBody = (v) => { const val = typeof v === 'function' ? v(body) : v; setBodyState(val); draftSet(dk, val); };
  const [priv, setPriv] = useState(false);
  return (
    <div className="comments">
      {comments.length === 0 && <div className="small muted" style={{ marginBottom: 6 }}>No shared comments yet.</div>}
      {comments.map((c) => (
        <div className="comment" key={c.id}>
          <div className="meta"><b>{c.author_email}</b><span>{fmtWhen(c.created_at)}</span>
            {(eq(c.author_email, email) || isManager) && <button className="iconbtn" style={{ marginLeft: 'auto', padding: '1px 6px' }} onClick={() => onDeleteComment(c)}>×</button>}
          </div>
          {c.body}
        </div>
      ))}
      <div className="comment-box">
        <textarea rows={2} placeholder={priv ? 'Private note — goes to your Journal only…' : 'Add a comment (shared with both of you)…'} value={body} onChange={(e) => setBody(e.target.value)} />
        <Mic onText={(t) => setBody((b) => (b ? b + ' ' : '') + t)} />
      </div>
      <div className="row" style={{ marginTop: 6 }}>
        <label className="checkline"><input type="checkbox" checked={priv} onChange={(e) => setPriv(e.target.checked)} /> Make private (saves to Journal)</label>
        <button className="btn sm" style={{ marginLeft: 'auto' }} disabled={body.trim().length < 2} onClick={async () => { const ok = await onComment(item, body.trim(), priv); if (ok) { setBodyState(''); draftClear(dk); setPriv(false); } }}>Post</button>
      </div>
    </div>
  );
}

/* ---------- Shared item form (add + edit, items 5 & 11) ---------- */
function ItemForm({ org, initial, onSubmit, onCancel, submitLabel = 'Add to plan', draftKey }) {
  const P = priorityCodes(org), V = valueCodes(org);
  const initTags = parseTags(initial?.tags);
  const [title, setTitleState] = useState(() => initial?.title || (draftKey ? draftGet(draftKey + '_t') : '') || '');
  const setTitle = (v) => { const val = typeof v === 'function' ? v(title) : v; setTitleState(val); if (draftKey) draftSet(draftKey + '_t', val); };
  const [phase, setPhase] = useState(String(initial?.phase || 60));
  const [track, setTrack] = useState(initial?.track || 'impact');
  const [selP, setSelP] = useState(initTags.filter((t) => t.startsWith('P')));
  const [selV, setSelV] = useState(initTags.filter((t) => t.startsWith('V')));
  const [measure, setMeasureState] = useState(() => initial?.success_measure || (draftKey ? draftGet(draftKey + '_m') : '') || '');
  const setMeasure = (v) => { const val = typeof v === 'function' ? v(measure) : v; setMeasureState(val); if (draftKey) draftSet(draftKey + '_m', val); };
  const [priority, setPriority] = useState(!!initial?.phase_critical);
  const [busy, setBusy] = useState(false);
  const toggle = (arr, set, code) => set(arr.includes(code) ? arr.filter((x) => x !== code) : [...arr, code]);

  async function submit() {
    setBusy(true);
    const ok = await onSubmit({ title: title.trim(), phase: +phase, track, tags: [...selP, ...selV], success_measure: measure.trim() || 'Define “done” together at the next dialogue', phase_critical: priority });
    setBusy(false);
    if (ok && draftKey) { draftClear(draftKey + '_t', draftKey + '_m'); setTitleState(''); setMeasureState(''); }
  }
  return (
    <div className="panel" style={{ borderColor: 'var(--cw-blue)' }}>
      <div className="field"><label>Title</label>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input style={{ flex: 1 }} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is the work or focus area?" />
          <Mic onText={(t) => setTitle((v) => (v ? v + ' ' : '') + t)} />
        </div>
      </div>
      <div className="row">
        <div className="field"><label>Phase</label>
          <select value={phase} onChange={(e) => setPhase(e.target.value)}>
            {PHASES.map((p) => <option key={p.n} value={p.n}>{p.range} · {p.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Track</label>
          <div className="seg">
            {[['impact', 'Impact'], ['acclimation', 'Acclimation']].map(([v, l]) => (
              <span key={v} className={`opt ${track === v ? 'on' : ''}`} onClick={() => setTrack(v)}>{l}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="field"><label>Strategic priorities it aligns to (select any)</label>
        <div className="seg">
          {P.map((code) => <span key={code} className={`opt ${selP.includes(code) ? 'on' : ''}`} title={tagTitle(code, org)} onClick={() => toggle(selP, setSelP, code)}>{code} · {tagTitle(code, org).slice(0, 26)}</span>)}
        </div>
      </div>
      <div className="field"><label>Core values it lives out (select any)</label>
        <div className="seg">
          {V.map((code) => <span key={code} className={`opt v ${selV.includes(code) ? 'on' : ''}`} title={tagTitle(code, org)} onClick={() => toggle(selV, setSelV, code)}>{code} · {tagTitle(code, org).split(' — ')[0]}</span>)}
        </div>
      </div>
      <div className="field"><label>Done means</label>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <input style={{ flex: 1 }} value={measure} onChange={(e) => setMeasure(e.target.value)} placeholder="Observable outcome" />
          <Mic onText={(t) => setMeasure((v) => (v ? v + ' ' : '') + t)} />
        </div>
      </div>
      <label className="checkline" style={{ marginBottom: 12 }}><input type="checkbox" checked={priority} onChange={(e) => setPriority(e.target.checked)} /> ★ Mark as a priority for this phase (max 2 active per phase)</label>
      <div className="row">
        <button className="btn" disabled={busy || title.trim().length < 4} onClick={submit}>{busy ? 'Saving…' : submitLabel}</button>
        {onCancel && <button className="btn ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

/* ---------- Plan view ---------- */
function PlanView({ org, items, comments, acks, email, isManager, plan, handlers }) {
  const [opCollapsed, setOpCollapsed] = useState(false);
  const [collapsed, setCollapsed] = useState({});
  const [statusF, setStatusF] = useState([]);
  const [priorityF, setPriorityF] = useState(false);
  const [tagF, setTagF] = useState('');
  const [openId, setOpenId] = useState(null);
  const dragRef = useRef(null);
  const op = org?.one_page || {};
  const openItem = openId ? items.find((i) => i.id === openId) : null;

  // Drag & drop among NON-starred items in the same phase+track (item 8)
  function dropOn(list, target) {
    const fromId = dragRef.current;
    dragRef.current = null;
    if (!fromId || fromId === target.id) return;
    const nonStar = list.filter((i) => !i.phase_critical);
    const ids = nonStar.map((i) => i.id);
    const from = ids.indexOf(fromId), to = ids.indexOf(target.id);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    handlers.onReorder(ids);
  }

  useEffect(() => {
    try { const s = localStorage.getItem('cw_collapsed'); if (s) setCollapsed(JSON.parse(s)); } catch {}
  }, []);
  const togglePhase = (n) => setCollapsed((c) => { const nx = { ...c, [n]: !c[n] }; try { localStorage.setItem('cw_collapsed', JSON.stringify(nx)); } catch {} return nx; });

  const toggleStatus = (s) => setStatusF((f) => (f.includes(s) ? f.filter((x) => x !== s) : [...f, s]));
  const match = (i) => (statusF.length === 0 || statusF.includes(i.status)) && (!priorityF || i.phase_critical) && (!tagF || (i.tags || []).includes(tagF));
  const anyFilter = statusF.length || priorityF || tagF;

  const flagged = items.filter((i) => flagFor(i, acks, email));

  return (
    <>
      <div className="onepage no-print">
        <div className="op-head">
          <div>
            <div className="kicker">{org?.name} OnePage · FY{op.fiscal_year}</div>
            {!opCollapsed && <h2>{op.core_purpose}</h2>}
          </div>
          <button className="collapse" onClick={() => setOpCollapsed((v) => !v)}>{opCollapsed ? 'Show OnePage' : 'Hide'}</button>
        </div>
        {!opCollapsed && (
          <>
            <div className="pinnacle">{op.pinnacle}</div>
            <div className="chips">{(op.priorities || []).map((p) => <span key={p.code} className="chip p" title={(p.bullets || []).join(' · ')}>{p.code} · {p.title}</span>)}</div>
            <div className="chips">{(org?.core_values || []).map((v) => <span key={v.code} className="chip v" title={v.description}>{v.code} · {v.name}</span>)}</div>
          </>
        )}
      </div>

      {flagged.length > 0 && (
        <div className="notice no-print">
          <span>{flagged.filter((i) => flagFor(i, acks, email) === 'new').length} new · {flagged.filter((i) => flagFor(i, acks, email) === 'edited').length} updated item(s) on your plan.</span>
          <button className="btn sm" onClick={() => handlers.ackAll(flagged)}>Mark all as seen</button>
        </div>
      )}

      <div className="filters no-print">
        <span className="flabel">Status</span>
        {STATUSES.map(([v, l]) => <button key={v} className={`fchip ${statusF.includes(v) ? 'on' : ''}`} onClick={() => toggleStatus(v)}>{l}</button>)}
        <span className="sep" />
        <button className={`fchip star ${priorityF ? 'on' : ''}`} onClick={() => setPriorityF((v) => !v)}>★ Priorities only</button>
        <select value={tagF} onChange={(e) => setTagF(e.target.value)} style={{ fontSize: 12.5 }}>
          <option value="">Any priority tag</option>
          {priorityCodes(org).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {anyFilter ? <button className="clearf" onClick={() => { setStatusF([]); setPriorityF(false); setTagF(''); }}>Clear filters</button> : null}
      </div>

      {PHASES.map((ph) => {
        const all = items.filter((i) => i.phase === ph.n);
        const phItems = all.filter(match);
        const done = all.filter((i) => i.status === 'done').length;
        const pct = all.length ? Math.round((done / all.length) * 100) : 0;
        const isCol = !!collapsed[ph.n];
        const endLbl = phaseEndLabel(plan, ph.n);
        return (
          <section className="phase" key={ph.n}>
            <div className={`phase-head ${isCol ? 'collapsed' : ''}`} onClick={() => togglePhase(ph.n)}>
              <span className="caret">▼</span>
              <h3>{ph.range} · {ph.name}</h3>
              {endLbl && <span className="phase-end">ends {endLbl}</span>}
              <span className="q">{ph.q}</span>
              <span className="count">{done}/{all.length} done{anyFilter ? ` · ${phItems.length} shown` : ''}</span>
            </div>
            {!isCol && (
              <div className="phase-body">
                <div className="progress"><div style={{ width: `${pct}%` }} /></div>
                <div className="tracks">
                  {['impact', 'acclimation'].map((tr) => {
                    const list = orderItems(phItems.filter((i) => i.track === tr));
                    return (
                      <div className="track" key={tr}>
                        <h4>{tr === 'impact' ? 'Impact — strategic priorities' : 'Acclimation — team, culture & values'}</h4>
                        {list.length === 0 && <div className="empty-track">{anyFilter ? 'Nothing matches the filters here.' : 'Nothing here yet.'}</div>}
                        {list.map((i) => (
                          <ItemTile key={i.id} item={i} flag={flagFor(i, acks, email)} onOpen={(it) => setOpenId(it.id)}
                            draggable={!i.phase_critical}
                            onDragStart={() => { dragRef.current = i.id; }}
                            onDragOver={(e) => { if (!i.phase_critical) e.preventDefault(); }}
                            onDrop={(e) => { e.preventDefault(); if (!i.phase_critical) dropOn(list, i); }} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        );
      })}
      {openItem && <ItemDrawer item={openItem} org={org} plan={plan} email={email} isManager={isManager} flag={flagFor(openItem, acks, email)} comments={comments} handlers={handlers} onClose={() => setOpenId(null)} />}
    </>
  );
}

/* ---------- Add to plan (manual + AI + from meeting, items 5 & 7) ---------- */
function AddView({ plan, org, isManager, email, reqs, handlers }) {
  const [mode, setMode] = useState('manual');
  return (
    <div className="addview">
      <div className="panel">
        <h3>Add to the plan</h3>
        <p className="sub">Structure work against the OnePage priorities and values. {isManager ? 'Items you add land on the plan and the new leader must acknowledge them.' : 'Your additions go to the leader for approval.'}</p>
        <div className="mode-tabs">
          {[['manual', 'Build it'], ['ai', 'AI assist'], ['meeting', 'From a meeting']].map(([k, l]) => (
            <button key={k} className={`mt ${mode === k ? 'on' : ''}`} onClick={() => setMode(k)}>{l}</button>
          ))}
        </div>
        {mode === 'manual' && <ItemForm org={org} draftKey={`bi_${plan.id}`} onSubmit={(patch) => handlers.addItem(patch)} submitLabel={isManager ? 'Add to plan' : 'Submit for approval'} />}
        {mode === 'ai' && <AiAssist plan={plan} org={org} onUse={(patch) => handlers.addItem(patch)} isManager={isManager} />}
        {mode === 'meeting' && <MeetingImport plan={plan} org={org} onAdd={(patch) => handlers.addItem(patch)} isManager={isManager} />}
      </div>

      <div className="panel">
        <h3>Requests</h3>
        <p className="sub">{isManager ? 'New-leader proposals awaiting your call — review and modify before adding.' : 'Your proposals and where they stand.'}</p>
        {reqs.length === 0 && <p className="sub">Nothing here yet.</p>}
        {reqs.map((r) => (
          <RequestRow key={r.id} req={r} org={org} isManager={isManager} handlers={handlers} />
        ))}
      </div>
    </div>
  );
}

/* ---------- One employee proposal, leader reviews with an editable form (item 6) ---------- */
function RequestRow({ req, org, isManager, handlers }) {
  const [reviewing, setReviewing] = useState(false);
  const [denyNote, setDenyNote] = useState('');
  const s = req.ai_suggestion || {};
  return (
    <div className="req">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="raw"><b>{s.title || req.raw_text}</b></div>
        <span className={`pill ${req.status}`}>{req.status}</span>
      </div>
      <div className="small muted">{req.raw_text}{req.source_url ? ` · from meeting` : ''} · by {req.requested_by} · {fmtDate(req.created_at?.slice(0, 10))}{s.denial_comment ? ` · declined: “${s.denial_comment}”` : ''}</div>
      {isManager && req.status === 'pending' && !reviewing && (
        <div className="row" style={{ marginTop: 10 }}><button className="btn sm" onClick={() => setReviewing(true)}>Review →</button></div>
      )}
      {isManager && req.status === 'pending' && reviewing && (
        <div style={{ marginTop: 10 }}>
          <ItemForm org={org}
            initial={{ title: s.title || req.raw_text, phase: s.phase, track: s.track, tags: parseTags(s.tags), success_measure: s.success_measure, phase_critical: s.phase_critical }}
            onCancel={() => setReviewing(false)}
            onSubmit={async (patch) => { const ok = await handlers.resolveReq(req, true, patch); if (ok !== false) setReviewing(false); return ok; }}
            submitLabel="Approve → add to plan" />
          <div className="row" style={{ marginTop: 8 }}>
            <input style={{ flex: 1 }} placeholder="Optional comment if declining…" value={denyNote} onChange={(e) => setDenyNote(e.target.value)} />
            <button className="btn ghost sm" onClick={() => { handlers.resolveReq(req, false, null, denyNote.trim()); setReviewing(false); }}>Decline</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Carousel of generated candidate items (AI assist + meeting import) ---------- */
function Carousel({ items, org, isManager, onAdd, onRemove }) {
  const [i, setI] = useState(0);
  if (!items || items.length === 0) return null;
  const idx = Math.min(i, items.length - 1);
  const c = items[idx];
  return (
    <div className="carousel">
      <div className="carousel-head">
        <button className="btn ghost sm" disabled={idx === 0} onClick={() => setI(idx - 1)}>‹ Prev</button>
        <span className="carousel-count">Item {idx + 1} of {items.length}</span>
        <button className="btn ghost sm" disabled={idx >= items.length - 1} onClick={() => setI(idx + 1)}>Next ›</button>
      </div>
      {c.rationale && <p className="small muted" style={{ margin: '0 0 8px' }}>Why: {c.rationale}</p>}
      <ItemForm
        key={idx}
        org={org}
        initial={{ title: c.title, phase: c.phase, track: c.track, tags: parseTags(c.tags), success_measure: c.success_measure, phase_critical: c.phase_critical }}
        onSubmit={async (patch) => {
          const ok = await onAdd({ ...patch, source_url: c.source_url });
          if (ok) { onRemove(idx); setI((p) => Math.max(0, Math.min(p, items.length - 2))); }
          return ok;
        }}
        submitLabel={isManager ? 'Add to plan' : 'Submit for approval'}
      />
    </div>
  );
}

/* Smart list typing: continue numbered (1. / 1)) or bulleted (* / - / •) lists on Enter,
   and exit the list when Enter is pressed on an empty marker line. */
function smartListKeyDown(e, setValue) {
  if (e.key !== 'Enter' || e.shiftKey) return;
  const ta = e.target;
  if (ta.selectionStart !== ta.selectionEnd) return;
  const pos = ta.selectionStart;
  const before = ta.value.slice(0, pos);
  const after = ta.value.slice(pos);
  const lineStart = before.lastIndexOf('\n') + 1;
  const line = before.slice(lineStart);
  const numM = line.match(/^(\s*)(\d+)([.)])\s+(.*)$/);
  const bulM = line.match(/^(\s*)([*\-•])\s+(.*)$/);
  if (!numM && !bulM) return;
  e.preventDefault();
  const content = numM ? numM[4] : bulM[3];
  if (content.trim() === '') {
    const newBefore = before.slice(0, lineStart);
    setValue(newBefore + after);
    requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = newBefore.length; });
    return;
  }
  const marker = numM ? `${numM[1]}${parseInt(numM[2], 10) + 1}${numM[3]} ` : `${bulM[1]}${bulM[2]} `;
  const insert = '\n' + marker;
  setValue(before + insert + after);
  const caret = pos + insert.length;
  requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = caret; });
}

function AiAssist({ plan, org, onUse, isManager }) {
  const dk = `ai_${plan.id}`;
  const [raw, setRawState] = useState(() => draftGet(dk));
  const setRaw = (v) => { const val = typeof v === 'function' ? v(raw) : v; setRawState(val); draftSet(dk, val); };
  const [cands, setCands] = useState(null);
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  async function suggest() {
    setBusy(true);
    try {
      const r = await fetch('/api/structure', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ raw, one_page: org.one_page, core_values: org.core_values, role_title: plan.role_title }) });
      const j = await r.json();
      setSource(j.source);
      setCands(j.items || []);
    } catch { alert('Could not generate suggestions — try again.'); }
    setBusy(false);
  }
  return (
    <div>
      <p className="sub">List one or more projects, focus areas, or relationships — number them or put one per line. Each becomes a full plan item you can review, edit, and add.</p>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <textarea rows={4} style={{ flex: 1 }} placeholder={'1. Take over the monthly Sypher delivery-credit review\n2. Build relationships across the Connections product team\n3. Document the onboarding runbook'} value={raw} onChange={(e) => setRaw(e.target.value)} onKeyDown={(e) => smartListKeyDown(e, setRaw)} />
        <Mic onText={(t) => setRaw((v) => (v ? v + ' ' : '') + t)} />
      </div>
      <div className="row" style={{ marginTop: 10 }}><button className="btn" disabled={busy || raw.trim().length < 8} onClick={suggest}>{busy ? 'Structuring…' : 'Structure items'}</button></div>
      {cands && cands.length === 0 && <p className="sub" style={{ marginTop: 12 }}>Couldn&apos;t pull items from that — try listing them more explicitly.</p>}
      {cands && cands.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p className="small muted" style={{ marginBottom: 8 }}>{cands.length} item(s) structured by {source === 'ai' ? 'AI against the current OnePage' : 'keyword matching'} — review, modify, and add each.</p>
          <Carousel items={cands} org={org} isManager={isManager} onAdd={onUse} onRemove={(x) => setCands((cs) => { const next = cs.filter((_, n) => n !== x); if (next.length === 0) { setRawState(''); draftClear(dk); } return next; })} />
        </div>
      )}
    </div>
  );
}

function MeetingImport({ plan, org, onAdd, isManager }) {
  const dk = `mt_${plan.id}`;
  const [url, setUrlState] = useState(() => draftGet(dk + '_u'));
  const setUrl = (v) => { setUrlState(v); draftSet(dk + '_u', v); };
  const [transcript, setTranscriptState] = useState(() => draftGet(dk));
  const setTranscript = (v) => { const val = typeof v === 'function' ? v(transcript) : v; setTranscriptState(val); draftSet(dk, val); };
  const [busy, setBusy] = useState(false);
  const [cands, setCands] = useState(null);
  async function generate() {
    setBusy(true);
    try {
      const r = await fetch('/api/transcript', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ transcript, url, one_page: org.one_page, core_values: org.core_values, role_title: plan.role_title }) });
      const j = await r.json();
      setCands(j.items || []);
    } catch { alert('Could not process the transcript — try again.'); }
    setBusy(false);
  }
  return (
    <div>
      <p className="sub">Paste a meeting link (e.g. Fireflies) or the transcript text — at least one. We&apos;ll pull out candidate plan items for you to review and approve.</p>
      <div className="field"><label>Meeting link</label><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://app.fireflies.ai/view/…" /></div>
      <div className="field"><label>Transcript</label>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <textarea rows={5} style={{ flex: 1 }} placeholder="Paste the meeting transcript here…" value={transcript} onChange={(e) => setTranscript(e.target.value)} onKeyDown={(e) => smartListKeyDown(e, setTranscript)} />
          <Mic onText={(t) => setTranscript((v) => (v ? v + ' ' : '') + t)} />
        </div>
      </div>
      <button className="btn" disabled={busy || (transcript.trim().length < 20 && !url.trim())} onClick={generate}>{busy ? 'Reading the meeting…' : 'Generate items'}</button>
      {cands && cands.length === 0 && <p className="sub" style={{ marginTop: 12 }}>No clear action items found — try a longer transcript.</p>}
      {cands && cands.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p className="small muted" style={{ marginBottom: 8 }}>{cands.length} candidate item(s). Review, modify, and add each.</p>
          <Carousel items={cands.map((c) => ({ ...c, source_url: url }))} org={org} isManager={isManager} onAdd={onAdd} onRemove={(x) => setCands((cs) => { const next = cs.filter((_, n) => n !== x); if (next.length === 0) { setTranscriptState(''); setUrlState(''); draftClear(dk, dk + '_u'); } return next; })} />
        </div>
      )}
    </div>
  );
}

/* ---------- Weekly check-in (employee) ---------- */
function CheckinView({ plan, items, cks, reload }) {
  const week = mondayOf(new Date());
  const existing = cks.find((c) => c.week_of === week);
  const [rows, setRows] = useState({});
  const [saving, setSaving] = useState(false);
  const active = items.filter((i) => i.status !== 'done');
  useEffect(() => {
    const init = {};
    for (const i of active) {
      const prev = existing?.check_in_items?.find((r) => r.plan_item_id === i.id);
      init[i.id] = prev ? { status: prev.status, confidence: prev.confidence || 3, note: prev.note || '', shared: prev.shared } : { status: i.status, confidence: 3, note: '', shared: true };
    }
    setRows(init); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, existing?.id]);
  const set = (id, k, v) => setRows((r) => ({ ...r, [id]: { ...r[id], [k]: v } }));
  async function save(submit) {
    setSaving(true);
    let ck = existing;
    if (!ck) {
      const { data, error } = await supabase.from('check_ins').upsert({ plan_id: plan.id, week_of: week }, { onConflict: 'plan_id,week_of' }).select().single();
      if (error) { alert(error.message); setSaving(false); return; }
      ck = data;
    }
    const payload = Object.entries(rows).map(([plan_item_id, r]) => ({ check_in_id: ck.id, plan_item_id, status: r.status, confidence: r.confidence, note: r.note || null, shared: r.shared }));
    let { error } = await supabase.from('check_in_items').upsert(payload, { onConflict: 'check_in_id,plan_item_id' });
    if (!error && submit) {
      ({ error } = await supabase.from('check_ins').update({ submitted_at: new Date().toISOString() }).eq('id', ck.id));
      if (!error) for (const [id, r] of Object.entries(rows)) await supabase.from('plan_items').update({ status: r.status }).eq('id', id);
    }
    setSaving(false);
    if (error) alert(error.message); else { alert(submit ? 'Check-in submitted.' : 'Draft saved.'); reload(); }
  }
  return (
    <div className="panel">
      <h3>Weekly check-in · week of {fmtDate(week)}</h3>
      <p className="sub">Status + confidence takes two minutes. Notes marked “share” appear in {plan.manager_name?.split(' ')[0] || 'your manager'}&apos;s dialogue prep.{existing?.submitted_at && <b> Submitted {fmtDate(existing.submitted_at.slice(0, 10))} — you can update and resubmit.</b>}</p>
      {active.map((i) => { const r = rows[i.id]; if (!r) return null; return (
        <div className="ci-row" key={i.id}>
          <div className="ci-title">{i.phase_critical ? '★ ' : ''}{i.title} <span className="small muted">· Day {i.phase}</span></div>
          <div className="ci-controls">
            <select value={r.status} onChange={(e) => set(i.id, 'status', e.target.value)}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
            <select value={r.confidence} onChange={(e) => set(i.id, 'confidence', +e.target.value)}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Confidence {n}/5</option>)}</select>
            <textarea rows={1} placeholder="Note (optional)" value={r.note} onChange={(e) => set(i.id, 'note', e.target.value)} />
            <label className="share-toggle"><input type="checkbox" checked={r.shared} onChange={(e) => set(i.id, 'shared', e.target.checked)} /> share</label>
          </div>
        </div>
      ); })}
      <div className="row" style={{ marginTop: 16 }}>
        <button className="btn ghost" disabled={saving} onClick={() => save(false)}>Save draft</button>
        <button className="btn" disabled={saving} onClick={() => save(true)}>{saving ? 'Saving…' : 'Submit check-in'}</button>
      </div>
    </div>
  );
}

/* ---------- Dialogue prep (manager) ---------- */
function PrepView({ plan, items, cks }) {
  const latest = cks.find((c) => c.submitted_at);
  if (!latest) return <div className="panel"><h3>Dialogue prep</h3><p className="sub">No submitted check-ins yet. Once {plan.employee_name?.split(' ')[0] || 'your new leader'} submits a check-in, this view assembles itself.</p></div>;
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
        <div className="panel"><h3>Unblock first</h3>
          {flags.map(({ item, ci }) => (
            <div className={`flag ${ci.status === 'at_risk' ? 'amber' : ''}`} key={item.id}><b>{statusLabel(ci.status)}:</b> {item.title}{ci.shared && ci.note ? <div className="small muted" style={{ marginTop: 4 }}>“{ci.note}”</div> : null}</div>
          ))}
        </div>
      )}
      <div className="panel"><h3>Shared notes</h3>
        {sharedNotes.length === 0 && <p className="sub">No shared notes this week.</p>}
        {sharedNotes.map(({ item, ci }) => (<div className="journal-note" key={item.id}><div className="date">{item.title} · {statusLabel(ci.status)} · confidence {ci.confidence}/5</div>{ci.note}</div>))}
      </div>
    </>
  );
}

/* ---------- Journal (item 13) ---------- */
function JournalView({ plan, email, entries, items, reload }) {
  const dk = `jr_${plan.id}`;
  const [body, setBodyState] = useState(() => draftGet(dk));
  const setBody = (v) => { const val = typeof v === 'function' ? v(body) : v; setBodyState(val); draftSet(dk, val); };
  async function add() {
    const { error } = await supabase.from('journal_entries').insert({ plan_id: plan.id, author_email: email, body, source: 'journal' });
    if (error) return alert(error.message);
    setBodyState(''); draftClear(dk); reload();
  }
  const titleOf = (id) => items.find((i) => i.id === id)?.title;
  return (
    <div className="panel">
      <h3>Private journal</h3>
      <p className="sub">Only you can ever read this — enforced at the database level. Private comments you make on plan items land here too.</p>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <textarea rows={4} style={{ flex: 1 }} placeholder="What's actually going on this week…" value={body} onChange={(e) => setBody(e.target.value)} />
        <Mic onText={(t) => setBody((v) => (v ? v + ' ' : '') + t)} />
      </div>
      <div className="row" style={{ margin: '10px 0 20px' }}><button className="btn" disabled={body.trim().length < 2} onClick={add}>Save entry</button></div>
      {entries.map((e) => (
        <div className="journal-note" key={e.id}>
          <div className="date">{fmtWhen(e.created_at)}{e.source === 'private_comment' && e.plan_item_id ? <span className="link"> · private note on “{titleOf(e.plan_item_id) || 'an item'}”</span> : ''}</div>
          {e.body}
        </div>
      ))}
      {entries.length === 0 && <p className="sub">No entries yet.</p>}
    </div>
  );
}

/* ---------- Activity + deletion log (item 10) ---------- */
function ActivityView({ events, isManager }) {
  const deleted = events.filter((e) => e.event_type === 'deleted');
  return (
    <>
      <div className="panel">
        <h3>Deleted items</h3>
        <p className="sub">{isManager ? 'Items removed from the plan.' : 'Items the leader removed from your plan.'}</p>
        {deleted.length === 0 && <p className="sub">Nothing deleted.</p>}
        {deleted.map((e) => (
          <div className="log-row" key={e.id}><span className="ev deleted">deleted</span><span>{e.title_snapshot} <span className="small muted">· Day {e.detail?.phase}</span></span><span className="when">{e.actor_email} · {fmtWhen(e.created_at)}</span></div>
        ))}
      </div>
      <div className="panel">
        <h3>Recent activity</h3>
        {events.slice(0, 40).map((e) => (
          <div className="log-row" key={e.id}><span className={`ev ${e.event_type}`}>{e.event_type}</span><span>{e.title_snapshot}</span><span className="when">{e.actor_email || '—'} · {fmtWhen(e.created_at)}</span></div>
        ))}
        {events.length === 0 && <p className="sub">No activity yet.</p>}
      </div>
    </>
  );
}

/* ---------- Download / notes / photo upload (item 14) ---------- */
function fileToB64(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); }); }

function DownloadView({ plan, org, items, notes, isManager, email, reload }) {
  const [noteText, setNoteText] = useState(plan.notes || '');
  const [savingNotes, setSavingNotes] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function saveNotes() { setSavingNotes(true); const { error } = await supabase.from('plans').update({ notes: noteText }).eq('id', plan.id); setSavingNotes(false); if (error) alert(error.message); else reload(); }

  async function onPhoto(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true);
    try {
      const path = `${plan.id}/${(crypto.randomUUID ? crypto.randomUUID() : Date.now())}.jpg`;
      const up = await supabase.storage.from('note-uploads').upload(path, file, { contentType: file.type || 'image/jpeg' });
      if (up.error) throw up.error;
      const { data: row, error } = await supabase.from('note_uploads').insert({ plan_id: plan.id, storage_path: path, created_by: email, status: 'uploaded' }).select().single();
      if (error) throw error;
      const b64 = await fileToB64(file);
      const res = await fetch('/api/ocr', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image_base64: b64, media_type: file.type || 'image/jpeg' }) }).then((r) => r.json());
      await supabase.from('note_uploads').update({ extracted_text: res.text || '', status: res.text ? 'processed' : 'uploaded' }).eq('id', row.id);
      if (res.note && !res.text) alert(res.note);
    } catch (err) { alert(err.message || 'Upload failed'); }
    setBusy(false); if (fileRef.current) fileRef.current.value = ''; reload();
  }

  return (
    <>
      <div className="panel no-print">
        <h3>Notes &amp; photo capture</h3>
        <p className="sub">Snap a photo of handwritten notes — we&apos;ll transcribe it so it can be added to the plan. {isManager ? 'The notes box below prints on the downloadable plan.' : 'Only the leader can edit the printed notes box.'}</p>
        <div className="upload-zone">
          Take or upload a photo of your notes
          <div><button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? 'Processing…' : '📷 Upload / take photo'}</button></div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onPhoto} />
        </div>
        {notes.map((n) => (
          <div className="note-thumb" key={n.id}>
            <div style={{ flex: 1 }}>
              <div className="small muted">{fmtWhen(n.created_at)} · {n.created_by} · {n.status}</div>
              <div style={{ fontSize: 13.5, marginTop: 4, whiteSpace: 'pre-wrap' }}>{n.extracted_text || <span className="muted">No text extracted — add ANTHROPIC_API_KEY to enable transcription.</span>}</div>
            </div>
          </div>
        ))}
        <div className="field" style={{ marginTop: 16 }}><label>Plan notes (prints on the PDF)</label>
          <textarea rows={4} value={noteText} onChange={(e) => setNoteText(e.target.value)} disabled={!isManager} placeholder="Context, next steps, open questions…" />
        </div>
        {isManager && <button className="btn ghost sm" disabled={savingNotes} onClick={saveNotes}>{savingNotes ? 'Saving…' : 'Save notes'}</button>}
        <div className="row" style={{ marginTop: 16 }}><button className="btn navy" onClick={() => window.print()}>⬇ Download / print plan (PDF)</button></div>
      </div>

      {/* Printable document */}
      <div className="doc">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><Logo /><h1 style={{ marginTop: 8 }}>30 / 60 / 90 Day Plan</h1></div>
          <div className="small muted" style={{ textAlign: 'right' }}>{plan.employee_name}<br />{plan.role_title}<br />Started {fmtDate(plan.start_date)}</div>
        </div>
        <p className="small muted" style={{ marginTop: 6 }}>{org?.name} · {org?.one_page?.core_purpose} · Pinnacle: {org?.one_page?.pinnacle}</p>
        {PHASES.map((ph) => {
          const list = items.filter((i) => i.phase === ph.n);
          return (
            <div key={ph.n}>
              <h2>{ph.range} · {ph.name}</h2>
              {['impact', 'acclimation'].map((tr) => {
                const l = list.filter((i) => i.track === tr);
                if (l.length === 0) return null;
                return (
                  <div key={tr}>
                    <h3>{tr === 'impact' ? 'Impact' : 'Acclimation'}</h3>
                    {l.map((i) => (
                      <div className="ditem" key={i.id}>
                        {i.phase_critical ? '★ ' : ''}<b>{i.title}</b> — {statusLabel(i.status)} {(i.tags || []).length ? `[${i.tags.join(', ')}]` : ''}
                        <div className="dm">Done means: {i.success_measure}{i.evidence ? ` · Evidence: ${i.evidence}` : ''}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
        <h2>Notes</h2>
        <div className="notes-lines">{plan.notes || ''}</div>
      </div>
    </>
  );
}

/* ---------- Acknowledge gate (item 12) ---------- */
function AckGate({ items, org, onAck, onAckAll, busy }) {
  return (
    <div className="modal-back">
      <div className="modal">
        <Logo />
        <h2>New items on your plan</h2>
        <p className="sub">Your leader added {items.length} item(s). Please review and acknowledge each before continuing.</p>
        {items.map((i) => (
          <div className="ack-item" key={i.id}>
            <div className="t">{i.phase_critical ? '★ ' : ''}{i.title}</div>
            <div className="m"><b>{phaseLabel(i.phase)}</b> · Done means: {i.success_measure} {(i.tags || []).length ? `· [${i.tags.join(', ')}]` : ''}</div>
            <div style={{ marginTop: 8 }}><button className="ackbtn" disabled={busy} onClick={() => onAck(i)}>Acknowledge</button></div>
          </div>
        ))}
        <div className="row" style={{ marginTop: 10 }}><button className="btn" disabled={busy} onClick={onAckAll}>Acknowledge all &amp; continue</button></div>
      </div>
    </div>
  );
}

/* ---------- Employee info module (leader; items 1-2) ---------- */
function EmployeeInfoView({ plan, reload }) {
  const [f, setF] = useState({
    employee_name: plan.employee_name || '', employee_email: plan.employee_email || '',
    role_title: plan.role_title || '', start_date: plan.start_date || '',
    plan_start_date: plan.plan_start_date || plan.start_date || '', day_mode: plan.day_mode || 'calendar',
  });
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    setBusy(true);
    const { error } = await supabase.from('plans').update({
      employee_name: f.employee_name.trim(), employee_email: f.employee_email.trim().toLowerCase(),
      role_title: f.role_title.trim() || 'New leader', start_date: f.start_date || null,
      plan_start_date: f.plan_start_date || null, day_mode: f.day_mode,
    }).eq('id', plan.id);
    setBusy(false);
    if (error) alert(error.message); else { alert('Employee info saved.'); reload(); }
  }
  return (
    <div className="panel">
      <h3>Employee info</h3>
      <p className="sub">The plan start date anchors the 30/60/90 phase windows; toggle whether days count as business days (M–F) or calendar days. Changing the email moves their login access to the new address.</p>
      <div className="row">
        <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Name</label><input value={f.employee_name} onChange={(e) => set('employee_name', e.target.value)} /></div>
        <div className="field" style={{ flex: 1, minWidth: 220 }}><label>Work email</label><input type="email" value={f.employee_email} onChange={(e) => set('employee_email', e.target.value)} /></div>
      </div>
      <div className="field"><label>Role title</label><input value={f.role_title} onChange={(e) => set('role_title', e.target.value)} /></div>
      <div className="row">
        <div className="field"><label>Employee start date</label><input type="date" value={f.start_date || ''} onChange={(e) => set('start_date', e.target.value)} /></div>
        <div className="field"><label>Plan start date</label><input type="date" value={f.plan_start_date || ''} onChange={(e) => set('plan_start_date', e.target.value)} /></div>
        <div className="field"><label>Phase days count as</label>
          <div className="seg">
            {[['calendar', 'Calendar days'], ['business', 'Business days (M–F)']].map(([v, l]) => (
              <span key={v} className={`opt ${f.day_mode === v ? 'on' : ''}`} onClick={() => set('day_mode', v)}>{l}</span>
            ))}
          </div>
        </div>
      </div>
      {f.plan_start_date && (
        <p className="small muted" style={{ marginBottom: 12 }}>
          Phase ends: Day 30 → <b>{phaseEndLabel({ plan_start_date: f.plan_start_date, day_mode: f.day_mode }, 30)}</b> ·
          Day 60 → <b>{phaseEndLabel({ plan_start_date: f.plan_start_date, day_mode: f.day_mode }, 60)}</b> ·
          Day 90 → <b>{phaseEndLabel({ plan_start_date: f.plan_start_date, day_mode: f.day_mode }, 90)}</b>
        </p>
      )}
      <button className="btn" disabled={busy || !f.employee_email.includes('@')} onClick={save}>{busy ? 'Saving…' : 'Save employee info'}</button>
    </div>
  );
}

/* ---------- App shell ---------- */
const NAV = (isManager, newCount) => [
  { k: 'plan', label: '30/60/90 Plan', ic: '▤', badge: newCount || 0 },
  isManager ? { k: 'prep', label: 'Dialogue Prep', ic: '◇' } : { k: 'checkin', label: 'Weekly Check-in', ic: '✓' },
  { k: 'add', label: 'Add to Plan', ic: '＋' },
  { k: 'journal', label: 'Journal', ic: '✎' },
  { k: 'activity', label: 'Activity', ic: '⟳' },
  { k: 'download', label: 'Download', ic: '⬇' },
  ...(isManager ? [{ k: 'info', label: 'Employee Info', ic: 'ⓘ' }] : []),
];

/* ---------- Team Overview (leader combined view across employees) ---------- */
function TeamOverview({ plans, byPlan, org, onOpen, handlers }) {
  const [empF, setEmpF] = useState([]);
  const [statusF, setStatusF] = useState([]);
  const [phaseF, setPhaseF] = useState([]);
  const all = plans.flatMap((p) => (byPlan.items[p.id] || []).map((i) => ({ ...i, _emp: p.employee_name || p.employee_email })));
  const toggle = (v, set) => set((f) => (f.includes(v) ? f.filter((x) => x !== v) : [...f, v]));
  const match = (i) => (empF.length === 0 || empF.includes(i.plan_id)) && (statusF.length === 0 || statusF.includes(i.status)) && (phaseF.length === 0 || phaseF.includes(i.phase));
  const anyF = empF.length || statusF.length || phaseF.length;
  const done = all.filter((i) => i.status === 'done').length;
  return (
    <>
      <div className="panel">
        <h3>Team overview</h3>
        <p className="sub">Everyone reporting to you, grouped by phase. Filter by employee, status, and phase — combinable (e.g. 90-day items that need your approval).</p>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          <div className="stat"><div className="n">{plans.length}</div><div className="l">employees</div></div>
          <div className="stat"><div className="n">{all.length}</div><div className="l">items</div></div>
          <div className="stat"><div className="n">{done}</div><div className="l">done</div></div>
        </div>
      </div>
      <div className="filters no-print">
        <span className="flabel">Employee</span>
        {plans.map((p) => <button key={p.id} className={`fchip ${empF.includes(p.id) ? 'on' : ''}`} onClick={() => toggle(p.id, setEmpF)}>{p.employee_name || p.employee_email}</button>)}
        <span className="sep" />
        <span className="flabel">Status</span>
        {STATUSES.map(([v, l]) => <button key={v} className={`fchip ${statusF.includes(v) ? 'on' : ''}`} onClick={() => toggle(v, setStatusF)}>{l}</button>)}
        <span className="sep" />
        <span className="flabel">Phase</span>
        {PHASES.map((p) => <button key={p.n} className={`fchip ${phaseF.includes(p.n) ? 'on' : ''}`} onClick={() => toggle(p.n, setPhaseF)}>{p.range}</button>)}
        {anyF ? <button className="clearf" onClick={() => { setEmpF([]); setStatusF([]); setPhaseF([]); }}>Clear</button> : null}
      </div>
      {PHASES.map((ph) => {
        const list = all.filter((i) => i.phase === ph.n && match(i));
        return (
          <section className="phase" key={ph.n}>
            <div className="phase-head" style={{ cursor: 'default' }}>
              <h3>{ph.range} · {ph.name}</h3>
              <span className="count">{list.length} item(s)</span>
            </div>
            <div className="phase-body">
              {list.length === 0 && <div className="empty-track">Nothing here{anyF ? ' for these filters' : ''}.</div>}
              {list.map((i) => (
                <div className="card" key={i.id}>
                  <div className="title">
                    <span className="empchip" onClick={() => onOpen(i.plan_id)} title="Open this plan">{i._emp}</span>
                    <span className="refno">#{i.ref_no || '–'}</span>
                    <span className="txt">{i.phase_critical ? '★ ' : ''}{i.title}</span>
                    {i.pending_edit && <span className="pendchip">APPROVAL PENDING</span>}
                  </div>
                  <div className="card-foot">
                    {(i.tags || []).map((t) => <Tag key={t} code={t} org={org} />)}
                    <span className={`status ${i.status}`}>{statusLabel(i.status)}</span>
                    <select value={i.status} onChange={(e) => handlers.onStatus(i, e.target.value)} style={{ marginLeft: 'auto' }} aria-label="Status">
                      {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <button className="iconbtn" onClick={() => onOpen(i.plan_id)}>Open →</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

/* ---------- Add Employee (leader) ---------- */
function AddEmployee({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  async function submit() {
    setBusy(true);
    const r = await onCreate({ name: name.trim(), email: email.trim().toLowerCase(), role_title: role.trim(), role_description: desc.trim() });
    setBusy(false);
    if (r.error) { alert(r.error); return; }
    setResult(r);
  }
  return (
    <div className="modal-back">
      <div className="modal">
        <Logo />
        {!result ? (
          <>
            <h2>Add an employee</h2>
            <p className="sub">We&apos;ll generate a starter 30/60/90 plan from the Cardwell OnePage, the values, and this role — a draft you both refine. Add any mandatory items yourself afterward.</p>
            <div className="field"><label>Name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" /></div>
            <div className="field"><label>Work email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@cardwellgroup.com" /></div>
            <div className="field"><label>Role title</label><input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Operations &amp; Enablement Lead" /></div>
            <div className="field"><label>Job role description</label><textarea rows={5} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What this role owns, key responsibilities, scope…" /></div>
            <div className="row">
              <button className="btn" disabled={busy || !name.trim() || !email.includes('@')} onClick={submit}>{busy ? 'Creating &amp; generating…' : 'Add employee & generate plan'}</button>
              <button className="btn ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        ) : (
          <>
            <h2>{name || 'Employee'} added</h2>
            <p className="sub">A starter plan was generated.{result.invite?.emailed ? ' An invite email was sent to them.' : ''}</p>
            {result.invite?.link ? (
              <div className="field"><label>Copyable sign-in link (send to {email})</label><textarea rows={3} readOnly value={result.invite.link} onClick={(e) => e.target.select()} /></div>
            ) : (
              <p className="sub">{result.invite?.note || `${email} can sign in at this app by entering their email to get a magic link — their plan already authorizes them.`}</p>
            )}
            <div className="row"><button className="btn" onClick={onClose}>Done</button></div>
          </>
        )}
      </div>
    </div>
  );
}

function App({ session }) {
  const email = session.user.email.toLowerCase();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [view, setView] = useState('team'); // 'team' or a plan id (leader)
  const [tab, setTab] = useState('plan');
  const [navOpen, setNavOpen] = useState(false);
  const [gateBusy, setGateBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const baselined = useRef(false);

  async function load() {
    const { data: rows, error } = await supabase.from('plans').select('*, organizations(*)').order('created_at');
    if (error) return setErr(error.message);
    const plans = rows || [];
    let org = plans[0]?.organizations || null;
    if (!org) { const { data: o } = await supabase.from('organizations').select('*').limit(1); org = o?.[0] || null; }
    const isManager = plans.length > 0 && plans.every((p) => eq(p.manager_email, email));
    const planIds = plans.map((p) => p.id);
    const empty = { items: {}, cks: {}, reqs: {}, journal: {}, comments: {}, acks: {}, events: {}, notes: {} };
    if (planIds.length === 0) { setData({ plans, org, isManager: true, by: empty }); return; }
    const [items, cks, reqs, journal, comments, acksR, events, notes] = await Promise.all([
      supabase.from('plan_items').select('*').in('plan_id', planIds).order('phase').order('sort_order'),
      supabase.from('check_ins').select('*, check_in_items(*)').in('plan_id', planIds).order('week_of', { ascending: false }),
      supabase.from('ad_hoc_requests').select('*').in('plan_id', planIds).order('created_at', { ascending: false }),
      supabase.from('journal_entries').select('*').in('plan_id', planIds).order('created_at', { ascending: false }),
      supabase.from('comments').select('*').in('plan_id', planIds).order('created_at'),
      supabase.from('item_acknowledgements').select('*').in('plan_id', planIds),
      supabase.from('plan_item_events').select('*').in('plan_id', planIds).order('created_at', { ascending: false }),
      supabase.from('note_uploads').select('*').in('plan_id', planIds).order('created_at', { ascending: false }),
    ]);
    const grp = (r) => { const m = {}; for (const id of planIds) m[id] = []; for (const x of (r || [])) { (m[x.plan_id] = m[x.plan_id] || []).push(x); } return m; };
    const by = { items: grp(items.data), cks: grp(cks.data), reqs: grp(reqs.data), journal: grp(journal.data), comments: grp(comments.data), acks: grp(acksR.data), events: grp(events.data), notes: grp(notes.data) };
    const myAcks = (acksR.data || []).filter((a) => eq(a.user_email, email));
    const allItems = items.data || [];
    if (myAcks.length === 0 && allItems.length > 0 && !baselined.current) {
      baselined.current = true;
      const rowsAck = allItems.map((i) => ({ plan_id: i.plan_id, plan_item_id: i.id, user_email: email, ack_version: i.content_version || 1 }));
      await supabase.from('item_acknowledgements').upsert(rowsAck, { onConflict: 'plan_item_id,user_email' });
      return load();
    }
    setData({ plans, org, isManager, by });
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (err) return <div className="center"><p style={{ color: 'var(--cw-red)' }}>{err}</p><button className="btn ghost" onClick={() => supabase.auth.signOut()}>Sign out</button></div>;
  if (!data) return <div className="center muted">Loading…</div>;

  const { plans, org, isManager, by } = data;
  const managerName = plans.find((p) => p.manager_name)?.manager_name || email;

  async function ackItem(item) { await supabase.from('item_acknowledgements').upsert({ plan_id: item.plan_id, plan_item_id: item.id, user_email: email, ack_version: item.content_version || 1, acknowledged_at: new Date().toISOString() }, { onConflict: 'plan_item_id,user_email' }); load(); }
  async function ackAll(list) { const rows = list.map((i) => ({ plan_id: i.plan_id, plan_item_id: i.id, user_email: email, ack_version: i.content_version || 1, acknowledged_at: new Date().toISOString() })); if (rows.length) await supabase.from('item_acknowledgements').upsert(rows, { onConflict: 'plan_item_id,user_email' }); load(); }
  async function onStatus(item, status) { let evidence = item.evidence; if (status === 'done' && !evidence) { evidence = window.prompt(`Marking done. What's the evidence?\n\n"${item.success_measure}"`); if (evidence === null) return; } const { error } = await supabase.from('plan_items').update({ status, evidence }).eq('id', item.id); if (error) alert(error.message); else load(); }
  async function onTogglePriority(item) { const { error } = await supabase.from('plan_items').update({ phase_critical: !item.phase_critical }).eq('id', item.id); if (error) alert(error.message.includes('two active priorities') ? `Phase ${item.phase} already has two active priorities. Mark one Done or unflag it first.` : error.message); else load(); }
  async function onSave(item, patch, note) {
    const fields = { title: patch.title, phase: patch.phase, track: patch.track, tags: patch.tags, success_measure: patch.success_measure, phase_critical: patch.phase_critical };
    // Employee editing an item they didn't create: change applies immediately but goes back
    // to the leader for approval, with the prior content kept so a decline can revert (item 3).
    if (!isManager && !eq(item.created_by, email)) {
      fields.pending_edit = {
        prior: { title: item.title, phase: item.phase, track: item.track, tags: item.tags, success_measure: item.success_measure, phase_critical: item.phase_critical },
        comment: note || null, requested_by: email, at: new Date().toISOString(),
      };
    }
    const { error } = await supabase.from('plan_items').update(fields).eq('id', item.id);
    if (error) { alert(friendly(error.message, patch.phase)); return false; }
    load(); return true;
  }
  async function onResolveEdit(item, approve, note) {
    const pe = item.pending_edit;
    if (!pe) return;
    if (approve) {
      const { error } = await supabase.from('plan_items').update({ pending_edit: null }).eq('id', item.id);
      if (error) return alert(error.message);
    } else {
      const p = pe.prior || {};
      const { error } = await supabase.from('plan_items').update({ title: p.title, phase: p.phase, track: p.track, tags: p.tags, success_measure: p.success_measure, phase_critical: p.phase_critical, pending_edit: null }).eq('id', item.id);
      if (error) return alert(friendly(error.message, p.phase));
      if (note) await supabase.from('comments').insert({ plan_id: item.plan_id, plan_item_id: item.id, author_email: email, body: `Edit declined: ${note}`, private: false });
    }
    load();
  }
  async function onReorder(orderedIds) {
    // Persist drag & drop order for non-starred items (item 8); spaced to leave room.
    for (let i = 0; i < orderedIds.length; i++) {
      await supabase.from('plan_items').update({ sort_order: (i + 1) * 10 }).eq('id', orderedIds[i]);
    }
    load();
  }
  async function onDelete(item) { if (!window.confirm(`Delete “${item.title}” (#${item.ref_no})? This is logged.`)) return; const { error } = await supabase.from('plan_items').delete().eq('id', item.id); if (error) alert(error.message); else load(); }
  async function addItem(patch, target) { if (isManager) { const { error } = await supabase.from('plan_items').insert({ plan_id: target.id, phase: patch.phase, track: patch.track, tags: patch.tags, title: patch.title, success_measure: patch.success_measure, phase_critical: patch.phase_critical, source: 'manager_added', created_by: email }); if (error) { alert(friendly(error.message, patch.phase)); return false; } } else { const { error } = await supabase.from('ad_hoc_requests').insert({ plan_id: target.id, raw_text: patch.title, ai_suggestion: { title: patch.title, phase: patch.phase, track: patch.track, tags: patch.tags, success_measure: patch.success_measure, phase_critical: patch.phase_critical }, requested_by: email, source_type: patch.source_url ? 'fireflies' : 'text', source_url: patch.source_url || null }); if (error) { alert(error.message); return false; } } load(); return true; }
  async function resolveReq(req, approve, patch, denyNote) {
    if (approve) {
      const s = patch || req.ai_suggestion || {};
      const { error } = await supabase.from('plan_items').insert({ plan_id: req.plan_id, phase: +(s.phase || 60), track: s.track || 'impact', tags: parseTags(s.tags), title: s.title || req.raw_text.slice(0, 140), success_measure: s.success_measure || 'Define “done” together at the next dialogue', phase_critical: !!s.phase_critical, source: 'employee_proposed', created_by: req.requested_by });
      if (error) { alert(friendly(error.message, s.phase)); return false; }
      await supabase.from('ad_hoc_requests').update({ status: 'approved', approved_by: email, ai_suggestion: { ...(req.ai_suggestion || {}), ...s } }).eq('id', req.id);
    } else {
      const sug = { ...(req.ai_suggestion || {}) };
      if (denyNote) sug.denial_comment = denyNote;
      await supabase.from('ad_hoc_requests').update({ status: 'rejected', approved_by: email, ai_suggestion: sug }).eq('id', req.id);
    }
    load(); return true;
  }
  async function onComment(item, body, priv) { let error; if (priv) ({ error } = await supabase.from('journal_entries').insert({ plan_id: item.plan_id, author_email: email, body, source: 'private_comment', plan_item_id: item.id })); else ({ error } = await supabase.from('comments').insert({ plan_id: item.plan_id, plan_item_id: item.id, author_email: email, body, private: false })); if (error) { alert(error.message); return false; } load(); return true; }
  async function onDeleteComment(c) { const { error } = await supabase.from('comments').delete().eq('id', c.id); if (error) alert(error.message); else load(); }

  async function createEmployee(f) {
    if (!org) return { error: 'No organization found.' };
    const { data: np, error } = await supabase.from('plans').insert({ org_id: org.id, manager_email: email, manager_name: managerName, employee_email: f.email, employee_name: f.name, role_title: f.role_title || 'New leader', role_description: f.role_description, start_date: new Date().toISOString().slice(0, 10), status: 'active' }).select('*, organizations(*)').single();
    if (error) return { error: error.message };
    try {
      const res = await fetch('/api/generate-plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role_title: f.role_title, role_description: f.role_description, one_page: org.one_page, core_values: org.core_values }) }).then((r) => r.json());
      const rows = (res.items || []).map((it, idx) => ({ plan_id: np.id, phase: [30, 60, 90].includes(+it.phase) ? +it.phase : 30, track: it.track === 'acclimation' ? 'acclimation' : 'impact', tags: parseTags(it.tags), title: String(it.title || '').slice(0, 200), success_measure: it.success_measure || 'Define “done” together at a weekly dialogue', source: 'ai_suggested', sort_order: idx }));
      if (rows.length) await supabase.from('plan_items').insert(rows);
    } catch (e) { /* generation optional */ }
    let invite = null;
    try { invite = await fetch('/api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: f.email, redirectTo: typeof window !== 'undefined' ? window.location.origin : '' }) }).then((r) => r.json()); } catch (e) {}
    await load();
    setView(np.id);
    return { plan: np, invite };
  }

  const handlers = { onStatus, onDelete, onSave, onTogglePriority, onAck: ackItem, ackAll, onComment, onDeleteComment, addItem, resolveReq, onResolveEdit, onReorder };

  /* ---------- Employee experience (own plan only) ---------- */
  if (!isManager) {
    const plan = plans[0];
    if (!plan) return <div className="center"><p>No onboarding plan is linked to this email yet.</p><button className="btn ghost" onClick={() => supabase.auth.signOut()}>Sign out</button></div>;
    const items = by.items[plan.id] || [], acks = by.acks[plan.id] || [];
    const mustAck = items.filter((i) => i.source === 'manager_added' && eq(i.created_by, plan.manager_email) && !acks.some((a) => a.plan_item_id === i.id && eq(a.user_email, email)));
    const nav = NAV(false, items.filter((i) => flagFor(i, acks, email)).length);
    const go = (k) => { setTab(k); setNavOpen(false); };
    const eh = { ...handlers, addItem: (p) => addItem(p, plan) };
    return (
      <>
        <header className="topbar"><div className="topbar-inner"><div className="row" style={{ gap: 12 }}><button className="hamburger no-print" onClick={() => setNavOpen((o) => !o)} aria-label="Menu">☰</button><div><Logo light /><div className="app-title">Leader Onboarding · {plan.employee_name} · {plan.role_title}</div></div></div><div className="userchip"><span className="role">New leader</span><span className="email-txt">{email}</span><button className="signout" onClick={() => supabase.auth.signOut()}>Sign out</button></div></div></header>
        {mustAck.length > 0 && <AckGate items={mustAck} org={org} busy={gateBusy} onAck={async (i) => { setGateBusy(true); await ackItem(i); setGateBusy(false); }} onAckAll={async () => { setGateBusy(true); await ackAll(mustAck); setGateBusy(false); }} />}
        <div className={`backdrop no-print ${navOpen ? 'show' : ''}`} onClick={() => setNavOpen(false)} />
        <div className="shell">
          <nav className={`sidebar no-print ${navOpen ? 'open' : ''}`}>{nav.map((n) => <button key={n.k} className={`navbtn ${tab === n.k ? 'active' : ''}`} onClick={() => go(n.k)}><span className="ic">{n.ic}</span>{n.label}{n.badge ? <span className="badge">{n.badge}</span> : null}</button>)}</nav>
          <main className="main">
            {tab === 'plan' && <PlanView org={org} items={items} comments={by.comments[plan.id] || []} acks={acks} email={email} isManager={false} plan={plan} handlers={handlers} />}
            {tab === 'checkin' && <CheckinView plan={plan} items={items} cks={by.cks[plan.id] || []} reload={load} />}
            {tab === 'add' && <AddView plan={plan} org={org} isManager={false} email={email} reqs={by.reqs[plan.id] || []} handlers={eh} />}
            {tab === 'journal' && <JournalView plan={plan} email={email} entries={by.journal[plan.id] || []} items={items} reload={load} />}
            {tab === 'activity' && <ActivityView events={by.events[plan.id] || []} isManager={false} />}
            {tab === 'download' && <DownloadView plan={plan} org={org} items={items} notes={by.notes[plan.id] || []} isManager={false} email={email} reload={load} />}
          </main>
        </div>
      </>
    );
  }

  /* ---------- Leader experience (team + drill-in) ---------- */
  const selPlan = view !== 'team' ? plans.find((p) => p.id === view) : null;
  const sItems = selPlan ? (by.items[selPlan.id] || []) : [];
  const sAcks = selPlan ? (by.acks[selPlan.id] || []) : [];
  const nav = selPlan ? NAV(true, sItems.filter((i) => flagFor(i, sAcks, email)).length) : [];
  const go = (k) => { setTab(k); setNavOpen(false); };
  const mh = selPlan ? { ...handlers, addItem: (p) => addItem(p, selPlan) } : handlers;
  return (
    <>
      <header className="topbar"><div className="topbar-inner"><div className="row" style={{ gap: 12 }}><button className="hamburger no-print" onClick={() => setNavOpen((o) => !o)} aria-label="Menu">☰</button><div><Logo light /><div className="app-title">{selPlan ? `${selPlan.employee_name} · ${selPlan.role_title}` : 'Team Onboarding'}</div></div></div><div className="userchip"><span className="role">Leader</span><span className="email-txt">{email}</span><button className="signout" onClick={() => supabase.auth.signOut()}>Sign out</button></div></div></header>
      {adding && <AddEmployee onClose={() => setAdding(false)} onCreate={createEmployee} />}
      <div className={`backdrop no-print ${navOpen ? 'show' : ''}`} onClick={() => setNavOpen(false)} />
      <div className="shell">
        <nav className={`sidebar no-print ${navOpen ? 'open' : ''}`}>
          <button className={`navbtn ${view === 'team' ? 'active' : ''}`} onClick={() => { setView('team'); setNavOpen(false); }}><span className="ic">▦</span>Team Overview</button>
          <div className="navsec">Employees</div>
          {plans.map((p) => <button key={p.id} className={`navbtn ${view === p.id ? 'active' : ''}`} onClick={() => { setView(p.id); setTab('plan'); setNavOpen(false); }}><span className="ic">•</span>{p.employee_name || p.employee_email}</button>)}
          <button className="navbtn addemp" onClick={() => setAdding(true)}><span className="ic">＋</span>Add Employee</button>
          {selPlan && <><div className="navsec">{selPlan.employee_name?.split(' ')[0] || 'Plan'}</div>{nav.map((n) => <button key={n.k} className={`navbtn ${tab === n.k ? 'active' : ''}`} onClick={() => go(n.k)}><span className="ic">{n.ic}</span>{n.label}{n.badge ? <span className="badge">{n.badge}</span> : null}</button>)}</>}
        </nav>
        <main className="main">
          {!selPlan && <TeamOverview plans={plans} byPlan={by} org={org} onOpen={(id) => { setView(id); setTab('plan'); }} handlers={handlers} />}
          {selPlan && tab === 'plan' && <PlanView org={org} items={sItems} comments={by.comments[selPlan.id] || []} acks={sAcks} email={email} isManager plan={selPlan} handlers={handlers} />}
          {selPlan && tab === 'prep' && <PrepView plan={selPlan} items={sItems} cks={by.cks[selPlan.id] || []} />}
          {selPlan && tab === 'add' && <AddView plan={selPlan} org={org} isManager email={email} reqs={by.reqs[selPlan.id] || []} handlers={mh} />}
          {selPlan && tab === 'journal' && <JournalView plan={selPlan} email={email} entries={by.journal[selPlan.id] || []} items={sItems} reload={load} />}
          {selPlan && tab === 'activity' && <ActivityView events={by.events[selPlan.id] || []} isManager />}
          {selPlan && tab === 'download' && <DownloadView plan={selPlan} org={org} items={sItems} notes={by.notes[selPlan.id] || []} isManager email={email} reload={load} />}
          {selPlan && tab === 'info' && <EmployeeInfoView plan={selPlan} reload={load} />}
        </main>
      </div>
    </>
  );
}

function friendly(msg, phase) {
  if (msg && msg.includes('two active priorities')) return `Phase ${phase} already has two active priorities. Mark one Done or unflag it first.`;
  if (msg && msg.includes('creator or the leader')) return 'Only the item creator or the leader can edit this item.';
  return msg;
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
