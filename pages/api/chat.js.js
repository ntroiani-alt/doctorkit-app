// Serverless API route: proxies chat messages to the Anthropic API.
// The API key is read from the ANTHROPIC_API_KEY environment variable and
// never exposed to the browser.

// Lightweight in-memory rate limiter: caps requests per IP to protect
// against runaway API costs from casual abuse. This map persists only for
// the lifetime of a given warm serverless instance — it is not a perfectly
// synced distributed limiter across cold starts or regions, but it stops
// a single source from hammering the endpoint, which is the realistic risk
// for a small-scale launch. If usage grows, swap this for a durable store
// (e.g. Vercel KV / Upstash Redis).
const RATE_LIMIT = 20; // max requests per window
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const requestLog = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const entry = requestLog.get(ip);
  if (!entry || now > entry.resetAt) {
    requestLog.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count += 1;
  return false;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown";

  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: "You've sent a lot of messages in a short time. Please wait a bit and try again.",
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "Server is missing ANTHROPIC_API_KEY. Add it in the Vercel project's Environment Variables settings.",
    });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "Request body must include a messages array." });
  }

  const SYSTEM_PROMPT =
    "You are a calm, practical coach inside 'Doctor-Visit Prep Kit' for women 50+ preparing to discuss memory/cognitive symptoms with a doctor. You NEVER diagnose. Your job is to help her turn vague worry into specific, sayable sentences she can use in an appointment, and to coach her through being taken seriously if a doctor is dismissive. Speak in short, warm, plain sentences, under 120 words, and when relevant give her an exact script line she can say out loud, in quotes.";

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Anthropic API error:", data);
      return res.status(response.status).json({
        error: data?.error?.message || "Anthropic API request failed.",
      });
    }

    const textBlock = data.content?.find((c) => c.type === "text");
    const reply = textBlock?.text || "I'm having trouble answering right now — try again in a moment.";

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Chat route error:", err);
    return res.status(500).json({ error: "Something went wrong reaching the model." });
  }
}
