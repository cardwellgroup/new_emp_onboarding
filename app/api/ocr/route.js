// Extracts handwritten/printed text from a photo of meeting notes (item 14, mobile upload).
// Uses Claude vision when ANTHROPIC_API_KEY is set; otherwise returns an empty result so the
// client can prompt the user to type the notes manually.

export async function POST(req) {
  const { image_base64 = '', media_type = 'image/jpeg' } = await req.json();
  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return Response.json({
      source: 'none',
      text: '',
      note: 'OCR is unavailable until ANTHROPIC_API_KEY is set in Vercel. The photo was saved — type the notes manually for now.',
    });
  }
  if (!image_base64) return Response.json({ source: 'none', text: '', note: 'No image provided.' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type, data: image_base64 } },
              {
                type: 'text',
                text: 'Transcribe all the text in this photo of meeting/onboarding notes. Preserve line breaks and bullet structure. Return ONLY the transcribed text, no commentary.',
              },
            ],
          },
        ],
      }),
    });
    const j = await r.json();
    const text = j?.content?.[0]?.text || '';
    return Response.json({ source: 'ai', text });
  } catch (e) {
    return Response.json({ source: 'error', text: '', note: 'Could not process the image — try again or type the notes manually.' });
  }
}
