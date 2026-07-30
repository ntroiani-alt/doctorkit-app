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

// Paper #FAF6F0 · Ink #2B2A33 · Plum #6B4059 · Sage #7C8B6F · Sand #E8DDC7 · Alert #C1583B

const QUESTIONS_TO_ASK = [
  "Is what I'm describing consistent with hormonal or age-related change, or should we test further?",
  "Should we check my thyroid, B12, and iron levels given these symptoms?",
  "Is this a good time to discuss HRT or other options for cognitive symptoms?",
  "What would make you personally want to investigate this further?",
  "Can we schedule a follow-up in 8-12 weeks to check if this pattern changes?",
];

const DISMISSAL_SCRIPT = [
  { line: "If they say \"that's just normal aging\"", reply: "I understand that's common — I'd still like it noted in my chart and a plan for if it continues." },
  { line: "If they rush the appointment", reply: "I have three specific things I tracked over the last month I'd like two minutes to walk through." },
  { line: "If they offer no next step", reply: "What would you want me to watch for, and when should I come back if it continues?" },
];

export default function App() {
  const [screen, setScreen] = useState("hero");
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Tell me what's worrying you or what happened at a past appointment, and I'll help you find the exact words to say to your doctor next time." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [logEntries, setLogEntries] = useState([]);
  const [logNote, setLogNote] = useState("");
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    (async () => {
      try {
        const stored = localStorage.getItem("doctorkit:log");
        if (stored) setLogEntries(JSON.parse(stored));
      } catch (e) {}
    })();
  }, []);

  async function saveEntry() {
    if (!logNote.trim()) return;
    const entry = { date: new Date().toLocaleDateString(), note: logNote };
    const updated = [entry, ...logEntries].slice(0, 30);
    try {
      localStorage.setItem("doctorkit:log", JSON.stringify(updated));
      setLogEntries(updated);
      setLogNote("");
    } catch (e) { console.error(e); }
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
      const reply =
        response.status === 429
          ? data.error || "You're sending messages a bit fast — please wait a moment and try again."
          : data.reply || "I'm having trouble answering right now — try again in a moment.";
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Something went wrong reaching me. Try again in a moment." }]);
    }
    setLoading(false);
  }

  const NavDot = ({ id, label }) => (
    <button
      onClick={() => setScreen(id)}
      style={{
        fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: "0.05em",
        padding: "8px 14px", borderRadius: 999,
        border: `1px solid ${screen === id ? "#6B4059" : "#D9CFC0"}`,
        background: screen === id ? "#6B4059" : "transparent",
        color: screen === id ? "#FAF6F0" : "#6B4059", cursor: "pointer", whiteSpace: "nowrap",
      }}
    >{label}</button>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#FAF6F0", color: "#2B2A33", fontFamily: "'Source Serif Pro', Georgia, serif" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Source+Serif+Pro:wght@400;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        h1, h2, h3 { font-family: 'Fraunces', serif; }
      `,
        }}
      />

      <header style={{ padding: "20px 20px 12px", display: "flex", gap: 8, flexWrap: "wrap", borderBottom: "1px solid #E8DDC7", position: "sticky", top: 0, background: "#FAF6F0", zIndex: 10 }}>
        <NavDot id="hero" label="Home" />
        <NavDot id="questions" label="Visit Questions" />
        <NavDot id="script" label="Advocate for Yourself" />
        <NavDot id="coach" label="Conversation Coach" />
        <NavDot id="log" label="My Notes" />
      </header>

       <div style={{ maxWidth: 640, margin: "12px auto 0", padding: "10px 16px", background: "#E8DDC7", borderRadius: 10, fontSize: 13, color: "#4A4852", textAlign: "center", boxShadow: "0 2px 8px rgba(43, 42, 51, 0.08)" }}>
        Not medical advice — for support and reflection only. Your notes stay private in your browser.
      </div>
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 80px" }}>
        {screen === "hero" && (
          <section>
            <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: "0.1em", color: "#6B4059", marginBottom: 12 }}>
              DOCTOR-VISIT PREP KIT
            </div>
            <h1 style={{ fontSize: 36, lineHeight: 1.15, margin: "0 0 20px", fontWeight: 600 }}>
              Walk in and finally get taken seriously.
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.6, color: "#4A4852", marginBottom: 28 }}>
              The exact questions to ask, what to say if you're brushed off, and a coach who helps you turn "I don't know, it's just been off" into words a doctor can actually act on.
            </p>
            <button onClick={() => setScreen("questions")} style={{ background: "#6B4059", color: "#FAF6F0", border: "none", padding: "16px 28px", fontSize: 17, borderRadius: 10, cursor: "pointer", fontFamily: "'Fraunces', serif", fontWeight: 600 }}>
              See the questions to ask →
            </button>
          </section>
        )}

        {screen === "questions" && (
          <section>
           <h2 style={{ fontSize: 24, marginBottom: 20 }}>Conversation Coach</h2>
            {QUESTIONS_TO_ASK.map((q, i) => (
              <div key={i} style={{ background: "#fff", border: "1px solid #E8DDC7", borderRadius: 12, padding: "18px 22px", marginBottom: 14, display: "flex", gap: 14 }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#7C8B6F", fontSize: 13, paddingTop: 2 }}>{String(i + 1).padStart(2, "0")}</span>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55 }}>"{q}"</p>
              </div>
            ))}
          </section>
        )}

        {screen === "script" && (
          <section>
            <h2 style={{ fontSize: 26, marginBottom: 20 }}>If they brush it off</h2>
            {DISMISSAL_SCRIPT.map((s, i) => (
              <div key={i} style={{ marginBottom: 24 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#C1583B", marginBottom: 6 }}>{s.line.toUpperCase()}</div>
                <div style={{ background: "#E8DDC7", borderRadius: 10, padding: "14px 18px", fontSize: 16, lineHeight: 1.5 }}>"{s.reply}"</div>
              </div>
            ))}
          </section>
        )}

        {screen === "coach" && (
          <section>
            <h2 style={{ fontSize: 24, marginBottom: 20 }}>Ask the Coach</h2>
            <div style={{ background: "#fff", border: "1px solid #E8DDC7", borderRadius: 14, padding: 20, height: 360, overflowY: "auto", marginBottom: 16 }}>
              {messages.map((m, i) => (
                <div key={i} style={{ marginBottom: 16, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "80%", background: m.role === "user" ? "#6B4059" : "#E8DDC7", color: m.role === "user" ? "#FAF6F0" : "#2B2A33", padding: "12px 16px", borderRadius: 12, fontSize: 15, lineHeight: 1.5 }}>
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
                placeholder="e.g. My doctor said it's just stress last time..."
                style={{ flex: 1, padding: "12px 14px", borderRadius: 8, border: "1px solid #D9CFC0", fontSize: 15, fontFamily: "inherit" }}
              />
              <button onClick={sendMessage} disabled={loading} style={{ background: "#6B4059", color: "#FAF6F0", border: "none", padding: "0 20px", borderRadius: 8, cursor: "pointer" }}>Send</button>
            </div>
          </section>
        )}

        {screen === "log" && (
          <section>
            <h2 style={{ fontSize: 24, marginBottom: 20 }}>My Notes for the Doctor</h2>
            <div style={{ background: "#fff", border: "1px solid #E8DDC7", borderRadius: 14, padding: 20, marginBottom: 24 }}>
              <textarea
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                placeholder="What do you want to remember to bring up?"
                rows={3}
                style={{ width: "100%", padding: 12, borderRadius: 8, border: "1px solid #D9CFC0", fontSize: 15, fontFamily: "inherit", marginBottom: 12, resize: "vertical" }}
              />
              <button onClick={saveEntry} disabled={!logNote.trim()} style={{ background: "#7C8B6F", color: "#FAF6F0", border: "none", padding: "12px 20px", borderRadius: 8, cursor: "pointer" }}>Save note</button>
            </div>
            {logEntries.length === 0 && <p style={{ color: "#8A8790", fontSize: 15 }}>No notes yet — jot down anything before it slips your mind.</p>}
            {logEntries.map((e, i) => (
              <div key={i} style={{ borderLeft: "3px solid #7C8B6F", paddingLeft: 14, marginBottom: 16 }}>
                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: "#6B4059" }}>{e.date}</div>
                <div style={{ fontSize: 15 }}>{e.note}</div>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
