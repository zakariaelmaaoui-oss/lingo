// Chat partner for Talaqa (طلاقة): a Vercel serverless function.
// The browser sends the conversation; this function asks Google Gemini (free tier) for a reply
// and a correction of the learner's last message, and sends both back as JSON.
// With body.mode "practice" it instead writes 5 multiple-choice exercises for one grammar lesson.
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

// Practice mode: five multiple-choice exercises on one grammar lesson (the lesson text comes from the page).
function practicePrompt(lang, level, lesson) {
  const name = LANGS[lang];
  return [
    `You write grammar exercises in ${name} for an Arabic-speaking learner (Moroccan) at CEFR level ${level}.`,
    "Write exactly 5 multiple-choice questions that test ONLY the grammar point of the lesson below.",
    `Each question is a short ${name} sentence with one gap written as ___ (or a short ${name} question).`,
    "Give 3 or 4 short options; exactly one is correct. Use simple vocabulary. Vary the questions.",
    "`answer` is the 0-based index of the correct option. `explain` is one short sentence in Modern Standard Arabic (فصحى) saying why.",
    "Double-check every answer: it must be the only grammatically correct option.",
    "Lesson title: " + String(lesson.t || "").slice(0, 200),
    "Lesson explanation: " + String(lesson.d || "").slice(0, 1500),
    "Return JSON only, matching the schema.",
  ].join("\n");
}

const PRACTICE_SCHEMA = {
  type: "OBJECT",
  properties: {
    questions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          q: { type: "STRING" },
          options: { type: "ARRAY", items: { type: "STRING" } },
          answer: { type: "INTEGER" },
          explain: { type: "STRING" },
        },
        required: ["q", "options", "answer", "explain"],
      },
    },
  },
  required: ["questions"],
};

async function callGemini(key, system, contents, schema) {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { responseMimeType: "application/json", responseSchema: schema, maxOutputTokens: 1500 },
      }),
    });
  } catch (e) {
    return { error: "network", status: 502 };
  }
  if (r.status === 429) return { error: "quota", status: 429 };
  if (!r.ok) {
    let detail = "";
    try { detail = (await r.json()).error.message; } catch (e) {}
    console.error("Gemini error", r.status, detail);
    return { error: "gemini", status: 502 };
  }
  try {
    const data = await r.json();
    const text = data.candidates[0].content.parts.map((p) => p.text || "").join("");
    return { out: JSON.parse(text) };
  } catch (e) {
    console.error("Gemini parse error", e);
    return { error: "parse", status: 502 };
  }
}

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
  const practice = body.mode === "practice";
  const msgs = Array.isArray(body.messages) ? body.messages.slice(-MAX_MESSAGES) : [];
  if (!lang) return send(res, 400, { error: "bad_request" });
  if (practice ? !(body.lesson && body.lesson.t) : !msgs.length || msgs[msgs.length - 1].role !== "user")
    return send(res, 400, { error: "bad_request" });

  const auth = String(req.headers.authorization || "");
  let uid = null;
  try {
    uid = await verifyUser(auth.startsWith("Bearer ") ? auth.slice(7) : "");
  } catch (e) {
    uid = null;
  }
  if (!uid) return send(res, 401, { error: "signin" });
  if (!underLimit(uid)) return send(res, 429, { error: "daily_limit" });

  if (practice) {
    const g = await callGemini(key, practicePrompt(lang, level, body.lesson), [{ role: "user", parts: [{ text: "Write the 5 exercises." }] }], PRACTICE_SCHEMA);
    if (g.error) return send(res, g.status, { error: g.error });
    const questions = (Array.isArray(g.out.questions) ? g.out.questions : [])
      .map((x) => ({
        q: String(x.q || ""),
        options: (Array.isArray(x.options) ? x.options : []).map(String).slice(0, 4),
        answer: Number(x.answer),
        explain: String(x.explain || ""),
      }))
      .filter((x) => x.q && x.options.length >= 2 && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < x.options.length)
      .slice(0, 5);
    if (!questions.length) return send(res, 502, { error: "parse" });
    return send(res, 200, { questions });
  }

  const contents = msgs
    .filter((m) => m && (m.role === "user" || m.role === "model") && typeof m.text === "string" && m.text.trim())
    .map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, MAX_CHARS) }] }));
  if (!contents.length || contents[0].role !== "user") contents.unshift({ role: "user", parts: [{ text: "Bonjour" }] });

  const g = await callGemini(key, systemPrompt(lang, level), contents, SCHEMA);
  if (g.error) return send(res, g.status, { error: g.error });
  const out = g.out;
  return send(res, 200, {
    reply: String(out.reply || ""),
    translation: String(out.translation || ""),
    correct: !!out.correct,
    corrected: String(out.corrected || ""),
    explanation: String(out.explanation || ""),
  });
};
