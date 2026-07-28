// Serverless API route: proxies chat messages to the Anthropic API.
// The API key is read from the ANTHROPIC_API_KEY environment variable and
// never exposed to the browser.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
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
