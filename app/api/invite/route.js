// Provisions / invites an employee login. The employee's plan row must already exist
// (the allowlist trigger authorizes their email once it's on a plan).
// With SUPABASE_SERVICE_ROLE_KEY set, this sends an invite email AND returns a copyable
// magic sign-in link. Without it, the employee can simply sign in themselves at the app.

import { createClient } from '@supabase/supabase-js';

export async function POST(req) {
  const { email = '', redirectTo = '' } = await req.json();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://siriqhbbkqehbetuorqd.supabase.co';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const clean = String(email).trim().toLowerCase();
  if (!clean) return Response.json({ ok: false, note: 'No email provided.' });

  if (!serviceKey) {
    return Response.json({
      ok: false,
      manual: true,
      note: `No SUPABASE_SERVICE_ROLE_KEY set, so no email was sent. ${clean} can sign in themselves: open the app and enter their email to get a magic link (their plan already authorizes them).`,
    });
  }

  try {
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const opts = redirectTo ? { redirectTo } : undefined;

    // Try to create + invite (sends the invite email). If they already exist, fall back to a magic link.
    let invited = false;
    const inv = await admin.auth.admin.inviteUserByEmail(clean, opts);
    if (!inv.error) invited = true;

    // Always produce a copyable sign-in link the leader can share directly.
    const linkType = invited ? 'invite' : 'magiclink';
    const gl = await admin.auth.admin.generateLink({ type: linkType, email: clean, options: opts });
    if (gl.error) {
      // If invite failed for an existing user, still try a plain magic link.
      const gl2 = await admin.auth.admin.generateLink({ type: 'magiclink', email: clean, options: opts });
      if (gl2.error) return Response.json({ ok: false, note: gl2.error.message });
      return Response.json({ ok: true, emailed: false, existed: true, link: gl2.data?.properties?.action_link || '' });
    }
    return Response.json({ ok: true, emailed: invited, existed: !invited, link: gl.data?.properties?.action_link || '' });
  } catch (e) {
    return Response.json({ ok: false, note: e.message || 'Could not provision the account.' });
  }
}
