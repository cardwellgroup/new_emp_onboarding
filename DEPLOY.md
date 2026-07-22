# Deploying v0.2 to emponboarding.vercel.app

The backend (Supabase) is already migrated and live. This deploys the frontend.
Both options below ship to your **existing** Vercel project, so the `emponboarding.vercel.app`
domain and the `ANTHROPIC_API_KEY` you already set are preserved.

## Option A — Git (recommended, uses your CI)

From your local clone of `cardwellgroup/new_emp_onboarding`:

```bash
# 1. Replace the app source with v0.2 (from the unzipped folder)
cp -R emp_onboarding_v2/app ./app
cp emp_onboarding_v2/package.json emp_onboarding_v2/next.config.mjs emp_onboarding_v2/vercel.json ./

# 2. Commit on a branch and push
git checkout -b onboarding-v2
git add -A
git commit -m "v0.2: collapsible phases, filters, left-nav, edit/delete, comments, ack gate, priorities, meeting import, note OCR, mobile, branding"
git push -u origin onboarding-v2
```

Open the PR on GitHub and merge to `main`. Vercel auto-builds and updates `emponboarding.vercel.app`.

## Option B — Vercel CLI (one-off production deploy)

```bash
cd emp_onboarding_v2
npm i -g vercel
vercel link          # select the existing "new-emp-onboarding" project
vercel --prod        # builds and promotes to production
```

## After deploying — verify the AI features (b)

`ANTHROPIC_API_KEY` is already in the project, so these should work immediately:

- **Add to Plan → AI assist:** type a rough item, click *Structure it* — it should return a titled,
  phased, tagged suggestion (source shows "AI against the current OnePage", not "keyword matching").
- **Add to Plan → From a meeting:** paste a transcript, click *Generate items* — you should get
  several candidate items to review.
- **Download → Upload / take photo:** upload a photo of notes — the transcribed text should appear
  under the upload.

If any of these show the heuristic/fallback message, confirm `ANTHROPIC_API_KEY` is set for the
Production environment in Vercel → Settings → Environment Variables, then redeploy.

## Logo

The app pulls Cardwell's logo from the cardwellgroup.com CDN at runtime (with an inline SVG
fallback). To self-host, drop the file in `public/` and set `LOGO_DARK` / `LOGO_WHITE` at the top of
`app/page.js` to e.g. `/cardwell-logo.svg`.
