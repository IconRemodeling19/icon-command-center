/* Vercel serverless function — proxy to Anthropic Messages API.
 *
 * Why a proxy: the Anthropic API key MUST stay server-side. If we used
 * REACT_APP_ANTHROPIC_KEY, the key would be baked into the JS bundle and
 * publicly exposed. Routing through this function keeps the key in
 * Vercel's server env and never reaches the browser.
 *
 * Required Vercel env var (set in Vercel dashboard → Project → Settings → Environment Variables):
 *   ANTHROPIC_API_KEY = sk-ant-...
 *
 * Client → POST /api/anthropic with JSON body:
 *   { messages, system?, model?, max_tokens?, temperature? }
 * Returns Anthropic's response JSON unchanged on success.
 */

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "ANTHROPIC_API_KEY not configured",
      hint: "Set ANTHROPIC_API_KEY in Vercel environment variables (Production + Preview)."
    });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { return res.status(400).json({ error: "Invalid JSON" }); }
  }

  const {
    messages,
    system,
    model = "claude-haiku-4-5-20251001",
    max_tokens = 1500,
    temperature = 0.7,
  } = body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "messages array required" });
  }

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens, temperature, system, messages }),
    });

    const text = await upstream.text();
    res.setHeader("Content-Type", "application/json");
    res.status(upstream.status).send(text);
  } catch (err) {
    res.status(502).json({ error: "Upstream call failed", message: String(err) });
  }
}
