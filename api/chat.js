// Chat partner for Talaqa (طلاقة): a Vercel serverless function.
// The browser sends the conversation; this function asks Google Gemini (free tier) for a reply
// and a correction of the learner's last message, and sends both back as JSON.
//
// Settings (Vercel → Project → Settings → Environment Variables):
//   GEMINI_API_KEY  required. Free key from https://aistudio.google.com (never put it in index.html).
//   GEMINI_MODEL    optional. Defaults to a free Flash-Lite model.
//
// Only people signed in with Google on the site can use it: the browser sends its Firebase ID token,
// and the function checks it with Google before calling Gemini.

const FIREBASE_WEB_KEY = "AIzaSyA36aex4YH8OfUZkJTtpsp69NKc6aRAA0U"; // public web key from config.js
const DEFAULT_MODEL = "gemini-3.5-flash-lite";
const MAX_MESSAGES = 20;
const MAX_CHARS = 500;
const DAILY_LIMIT = 80; // per person, per server instance (a soft guard; Google's own free quota is the real limit)

const LANGS = { fr: "French", de: "German" };
const LEVELS = ["A1", "A2", "B1", "B2"];
const counts = new Map();

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || "{}");
}

async function verifyUser(idToken) {
  if (!idToken) return null;
  const r = await fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + FIREBASE_WEB_KEY,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Referer: "https://lingo-two-sand.vercel.app/" },
      body: JSON.stringify({ idToken }),
    }
  );
  if (!r.ok) return null;
  const data = await r.json();
  const u = data && data.users && data.users[0];
  return u ? u.localId : null;
}

function underLimit(uid) {
  const day = new Date().toISOString().slice(0, 10);
  const key = uid + ":" + day;
  const n = (counts.get(key) || 0) + 1;
  if (counts.size > 5000) counts.clear();
  counts.set(key, n);
  return n <= DAILY_LIMIT;
}

function systemPrompt(lang, level) {
  const name = LANGS[lang];
  return [
    `You are a friendly ${name} conversation partner for an Arabic-speaking learner (Moroccan) at CEFR level ${level}.`,
    `Keep the conversation going in ${name} only, with short replies (1 to 3 sentences) using vocabulary and grammar suited to level ${level}.`,
    "End most replies with a simple question so the learner keeps talking. Stay kind and encouraging.",
    "Also check the learner's LAST message for mistakes in grammar, spelling, accents, articles, gender and word choice.",
    "If the learner writes in Arabic or another language, reply in the target language anyway and give, as the correction, how to say it in the target language.",
    "Write `explanation` and `translation` in Modern Standard Arabic (فصحى), short and clear.",
    "Return JSON only, matching the schema.",
  ].join("\n");
}

const SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING", description: "Your next message in the target language." },
    translation: { type: "STRING", description: "Arabic (MSA) translation of reply." },
    correct: { type: "BOOLEAN", description: "True if the learner's last message had no mistakes." },
    corrected: { type: "STRING", description: "The learner's last message, corrected. Same as the original if correct." },
    explanation: { type: "STRING", description: "Short Arabic (MSA) explanation of each mistake. Empty if correct." },
  },
  required: ["reply", "translation", "correct", "corrected", "explanation"],
};

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method" });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return send(res, 503, { error: "not_configured" });

  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    return send(res, 400, { error: "bad_json" });
  }

  const lang = LANGS[body.lang] ? body.lang : null;
  const level = LEVELS.includes(body.level) ? body.level : "A1";
  const msgs = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
  if (!lang || !msgs.length || msgs[msgs.length - 1].role !== "user") return send(res, 400, { error: "bad_request" });

  const auth = String(req.headers.authorization || "");
  let uid = null;
  try {
    uid = await verifyUser(auth.startsWith("Bearer ") ? auth.slice(7) : "");
  } catch (e) {
    uid = null;
  }
  if (!uid) return send(res, 401, { error: "signin" });
  if (!underLimit(uid)) return send(res, 429, { error: "daily_limit" });

  const contents = msgs
    .filter((m) => m && (m.role === "user" || m.role === "model") && typeof m.text === "string" && m.text.trim())
    .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, MAX_CHARS) }] }));
  if (!contents.length || contents[0].role !== "user") contents.unshift({ role: "user", parts: [{ text: "Bonjour" }] });

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(lang, level) }] },
        contents,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
          maxOutputTokens: 800,
        },
      }),
    });
  } catch (e) {
    return send(res, 502, { error: "network" });
  }

  if (r.status === 429) return send(res, 429, { error: "quota" });
  if (!r.ok) {
    let detail = "";
    try { detail = (await r.json()).error.message; } catch (e) {}
    console.error("Gemini error", r.status, detail);
    return send(res, 502, { error: "gemini", status: r.status });
  }

  try {
    const data = await r.json();
    const text = data.candidates[0].content.parts.map((p) => p.text || "").join("");
    const out = JSON.parse(text);
    return send(res, 200, {
      reply: String(out.reply || ""),
      translation: String(out.translation || ""),
      correct: !!out.correct,
      corrected: String(out.corrected || ""),
      explanation: String(out.explanation || ""),
    });
  } catch (e) {
    console.error("Gemini parse error", e);
    return send(res, 502, { error: "parse" });
  }
};
