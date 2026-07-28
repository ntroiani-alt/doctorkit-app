import React, { useState, useEffect, useRef } from "react";

// Lightweight inline-markdown renderer for chat replies: handles **bold**,
// *italic*, and "- " bullet lines without pulling in a markdown library.
function renderInline(text, keyPrefix) {
  const parts = [];
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let lastIndex = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    if (match[1] !== undefined) {
      parts.push(<strong key={`${keyPrefix}-${key++}`}>{match[1]}</strong>);
    } else if (match[2] !== undefined) {
      parts.push(<em key={`${keyPrefix}-${key++}`}>{match[2]}</em>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function renderMarkdown(text) {
  const lines = String(text).split("\n").filter((l) => l.trim() !== "");
  return lines.map((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("- ")) {
      return (
        <div key={i} style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <span>•</span>
          <span>{renderInline(trimmed.slice(2), `l${i}`)}</span>
        </div>
      );
    }
    return (
      <div key={i} style={{ marginTop: i === 0 ? 0 : 8 }}>
        {renderInline(line, `l${i}`)}
      </div>
    );
  });
}

// ---- Design tokens ----
// Paper #FAF6F0 · Ink #2B2A33 · Plum #6B4059 · Sage #7C8B6F · Sand #E8DDC7 · Alert #C1583B

const QUIZ = [
  { q: "You walk into a room and forget why you're there.", weight: 1 },
  { q: "You lose a word mid-sentence, then find it 30 seconds later.", weight: 1 },
  { q: "You've missed the same appointment or errand more than once this month.", weight: 1 },
  { q: "You've gotten lost somewhere very familiar to you.", weight: 3 },
  { q: "A close friend or family member has mentioned a change in your memory, unprompted.", weight: 2 },
  { q: "You've had trouble following a conversation you used to follow easily.", weight: 1 },
  { q: "You feel foggier in the week before your period or since menopause started.", weight: -1 },
  { q: "You've repeated the same story to the same person without realizing.", weight: 2 },
];

function tierFor(score) {
  if (score <= 2) return {
    label: "This is ordinary brain fog",
    color: "#7C8B6F",
    body: "What you're describing lines up with normal hormonal and age-related fog — annoying, not alarming. It's worth mentioning at your next regular check-up, not worth losing sleep over tonight."
  };
  if (score <= 5) return {
    label: "Worth a conversation, not a crisis",
    color: "#B08F3D",
    body: "You're in a gray zone enough people live in comfortably, but a couple of your answers are worth tracking for a few weeks and raising at your next doctor's visit — not urgently, just on purpose."
  };
  return {
    label: "Please bring this to a doctor soon",
    color: "#C1583B",
    body: "A couple of your answers are the kind of pattern doctors actually want to know about early. This doesn't mean anything is seriously wrong — it means it's time for a real conversation, not more Googling."
  };
}

function Dial({ pct, color }) {
  const angle = -90 + pct * 1.8; // -90 to 90
  return (
    <svg viewBox="0 0 200 120" width="220" height="140">
      <path d="M 20 110 A 80 80 0 0 1 180 110" fill="none" stroke="#E8DDC7" strokeWidth="14" strokeLinecap="round" />
      <path
        d="M 20 110 A 80 80 0 0 1 180 110"
        fill="none"
        stroke={color}
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * 251} 251`}
      />
      <g transform={`rotate(${angle} 100 110)`}>
        <line x1="100" y1="110" x2="100" y2="45" stroke="#2B2A33" strokeWidth="3" strokeLinecap="round" />
      </g>
      <circle cx="100" cy="110" r="7" fill="#2B2A33" />
    </svg>
  );
}

export default function App() {
  const [screen, setScreen] = useState("hero"); // hero | quiz | result | companion | log
  const [answers, setAnswers] = useState(Array(QUIZ.length).fill(null));
  const [qIndex, setQIndex] = useState(0);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "I'm here to talk through whatever's on your mind — a moment you forgot, a word that slipped, anything. I won't diagnose you, but I'll tell you honestly what's ordinary and what's worth a doctor's attention." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [logEntries, setLogEntries] = useState([]);
  const [logNote, setLogNote] = useState("");
  const [logSleep, setLogSleep] = useState("7");
  const [logStress, setLogStress] = useState("3");
  const [saving, setSaving] = useState(false);
  const chatEndRef = useRef(null);

  const rawScore = answers.reduce((sum, a, i) => (a ? sum + QUIZ[i].weight : sum), 0);
  const score = Math.max(0, rawScore);
  const tier = tierFor(score);
  const pct = Math.min(100, (score / 12) * 100);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem("brainfog:log");
        if (stored) setLogEntries(JSON.parse(stored));
      } catch (e) { /* no entries yet */ }
    })();
  }, []);

  async function saveLog() {
    setSaving(true);
    const entry = {
      date: new Date().toLocaleDateString(),
      note: logNote,
      sleep: logSleep,
      stress: logStress,
    };
    const updated = [entry, ...logEntries].slice(0, 30);
    try {
      localStorage.setItem("brainfog:log", JSON.stringify(updated));
      setLogEntries(updated);
      setLogNote("");
    } catch (e) {
      console.error("save failed", e);
    }
    setSaving(false);
  }

  async function sendMessage() {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", text: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.text,
          })),
        }),
      });
      const data = await response.json();
      const reply = data.reply || "I'm having trouble answering right now — try asking again in a moment.";
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Something went wrong reaching me just now. Try again in a moment." }]);
    }
    setLoading(false);
  }

  const NavDot = ({ id, label }) => (
    <button
      onClick={() => setScreen(id)}
      style={{
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 12,
        letterSpacing: "0.05em",
        padding: "8px 14px",
        borderRadius: 999,
        border: `1px solid ${screen === id ? "#6B4059" : "#D9CFC0"}`,
        background: screen === id ? "#6B4059" : "transparent",
        color: screen === id ? "#FAF6F0" : "#6B4059",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#FAF6F0", color: "#2B2A33", fontFamily: "'Source Serif Pro', Georgia, serif" }}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Source+Serif+Pro:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        h1, h2, h3 { font-family: 'Fraunces', serif; }
        button { font-family: inherit; }
        ::selection { background: #E8DDC7; }
      `}</style>

      <header style={{ padding: "20px 20px 12px", display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid #E8DDC7", position: "sticky", top: 0, background: "#FAF6F0", zIndex: 10 }}>
        <NavDot id="hero" label="Start" />
        <NavDot id="quiz" label="Quick Check" />
        <NavDot id="companion" label="Ask" />
        <NavDot id="log" label="My Log" />
      </header>

      <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 80px" }}>
        {screen === "hero" && (
          <section>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: "0.1em", color: "#6B4059", marginBottom: 12 }}>
              WAIT, WAS THAT NORMAL?
            </div>
            <h1 style={{ fontSize: 40, lineHeight: 1.1, margin: "0 0 20px", fontWeight: 600 }}>
              You are not losing your mind.
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.6, color: "#4A4852", marginBottom: 28 }}>
              Forgot why you walked into the room again? Before you spiral into 2am Googling — take the 90-second check, then ask your question directly and get a real, calm answer.
            </p>
            <button
              onClick={() => setScreen("quiz")}
              style={{
                background: "#6B4059",
                color: "#FAF6F0",
                border: "none",
                padding: "16px 28px",
                fontSize: 17,
                borderRadius: 10,
                cursor: "pointer",
                fontFamily: "'Fraunces', serif",
                fontWeight: 600,
              }}
            >
              Start the 90-second check →
            </button>
            <div style={{ marginTop: 40, padding: 20, background: "#E8DDC7", borderRadius: 12, fontSize: 15, color: "#4A4852" }}>
              Inside: the Quick Check dial, an AI companion you can ask anything, and a private daily log that saves itself — so next time you're not starting from scratch.
            </div>
          </section>
        )}

        {screen === "quiz" && (
          <section>
            <h2 style={{ fontSize: 26, marginBottom: 6 }}>Quick Check</h2>
            <p style={{ color: "#6B4059", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, marginBottom: 24 }}>
              QUESTION {qIndex + 1} OF {QUIZ.length}
            </p>
            <div style={{ background: "#fff", border: "1px solid #E8DDC7", borderRadius: 14, padding: 28, marginBottom: 20 }}>
              <p style={{ fontSize: 20, lineHeight: 1.5, marginBottom: 24 }}>{QUIZ[qIndex].q}</p>
              <div style={{ display: "flex", gap: 12 }}>
                {["Yes", "No"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      const a = [...answers];
                      a[qIndex] = opt === "Yes";
                      setAnswers(a);
                      if (qIndex < QUIZ.length - 1) setQIndex(qIndex + 1);
                      else setScreen("result");
                    }}
                    style={{
                      flex: 1,
                      padding: "14px 0",
                      fontSize: 16,
                      borderRadius: 8,
                      border: "1px solid #6B4059",
                      background: opt === "Yes" ? "#6B4059" : "transparent",
                      color: opt === "Yes" ? "#FAF6F0" : "#6B4059",
                      cursor: "pointer",
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: 4, background: "#E8DDC7", borderRadius: 2 }}>
              <div style={{ height: 4, width: `${(qIndex / QUIZ.length) * 100}%`, background: "#7C8B6F", borderRadius: 2, transition: "width .3s" }} />
            </div>
          </section>
        )}

        {screen === "result" && (
          <section style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 24, marginBottom: 4 }}>Your result</h2>
            <div style={{ display: "flex", justifyContent: "center", margin: "12px 0" }}>
              <Dial pct={pct} color={tier.color} />
            </div>
            <h3 style={{ fontSize: 28, color: tier.color, margin: "0 0 16px" }}>{tier.label}</h3>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: "#4A4852", maxWidth: 480, margin: "0 auto 28px" }}>{tier.body}</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button onClick={() => setScreen("companion")} style={{ background: "#6B4059", color: "#FAF6F0", border: "none", padding: "14px 22px", borderRadius: 8, fontSize: 15, cursor: "pointer" }}>
                Ask a follow-up question
              </button>
              <button onClick={() => { setAnswers(Array(QUIZ.length).fill(null)); setQIndex(0); setScreen("quiz"); }} style={{ background: "transparent", color: "#6B4059", border: "1px solid #6B4059", padding: "14px 22px", borderRadius: 8, fontSize: 15, cursor: "pointer" }}>
                Retake check
              </button>
            </div>
          </section>
        )}

        {screen === "companion" && (
          <section>
            <h2 style={{ fontSize: 24, marginBottom: 20 }}>Ask your question</h2>
            <div style={{ background: "#fff", border: "1px solid #E8DDC7", borderRadius: 14, padding: 20, height: 380, overflowY: "auto", marginBottom: 16 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 16, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "80%",
                    background: m.role === "user" ? "#6B4059" : "#E8DDC7",
                    color: m.role === "user" ? "#FAF6F0" : "#2B2A33",
                    padding: "12px 16px",
                    borderRadius: 12,
                    fontSize: 15,
                    lineHeight: 1.5,
                  }}>
                    {renderMarkdown(m.text)}
                  </div>
                </div>
              ))}
              {loading && <div style={{ color: "#6B4059", fontSize: 14, fontStyle: "italic" }}>thinking…</div>}
              <div ref={chatEndRef} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                placeholder="e.g. I forgot my neighbor's name today..."
                style={{ flex: 1, padding: "12px 14px", borderRadius: 8, border: "1px solid #D9CFC0", fontSize: 15, fontFamily: "inherit" }}
              />
              <button onClick={sendMessage} disabled={loading} style={{ background: "#6B4059", color: "#FAF6F0", border: "none", padding: "0 20px", borderRadius: 8, cursor: "pointer" }}>
                Send
              </button>
            </div>
          </section>
        )}

        {screen === "log" && (
          <section>
            <h2 style={{ fontSize: 24, marginBottom: 20 }}>My Daily Log</h2>
            <div style={{ background: "#fff", border: "1px solid #E8DDC7", borderRadius: 14, padding: 20, marginBottom: 24 }}>
              <textarea
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                placeholder="What happened today?"
                rows={3}
                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #D9CFC0", fontSize: 15, fontFamily: "inherit", marginBottom: 12, resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                <label style={{ fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>
                  Sleep (hrs)
                  <input type="number" value={logSleep} onChange={(e) => setLogSleep(e.target.value)} style={{ display: "block", width: 70, marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #D9CFC0" }} />
                </label>
                <label style={{ fontSize: 13, fontFamily: "'IBM Plex Mono', monospace" }}>
                  Stress (1-5)
                  <input type="number" min="1" max="5" value={logStress} onChange={(e) => setLogStress(e.target.value)} style={{ display: "block", width: 70, marginTop: 4, padding: 8, borderRadius: 6, border: "1px solid #D9CFC0" }} />
                </label>
              </div>
              <button onClick={saveLog} disabled={saving || !logNote.trim()} style={{ background: "#7C8B6F", color: "#FAF6F0", border: "none", padding: "12px 20px", borderRadius: 8, cursor: "pointer" }}>
                {saving ? "Saving…" : "Save entry"}
              </button>
            </div>
            <div>
              {logEntries.length === 0 && <p style={{ color: "#8A8790", fontSize: 15 }}>No entries yet — your first one starts the pattern.</p>}
              {logEntries.map((e, i) => (
                <div key={i} style={{ borderLeft: "3px solid #7C8B6F", paddingLeft: 14, marginBottom: 16 }}>
                  <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#6B4059" }}>{e.date} · sleep {e.sleep}h · stress {e.stress}/5</div>
                  <div style={{ fontSize: 15 }}>{e.note}</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
