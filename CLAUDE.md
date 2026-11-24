# Talaqa (طلاقة) — learn French and German in Arabic

The site's name is **طلاقة (Talaqa)**; its logo is the `LOGO` SVG in index.html (also inlined as the favicon).
The repository and storage keys still say `lingo` — keep them, renaming them would lose saved progress.

A static website (no build step, no npm) for learning French and German from A1 to B2.
It is deployed on Vercel from the `main` branch: https://lingo-two-sand.vercel.app

The owner is a beginner and does not code. Reply to him in Moroccan Darija (Latin letters are fine),
explain changes simply, and tell him exactly what to click to publish them.

## Files

- `index.html` — the whole app: CSS, vocabulary data, grammar lessons and all JavaScript, in one file.
- `config.js` — Firebase settings for project `lingo-fc227`. **Never delete, empty or set this to `null`.**
  Without it Google sign-in, saving progress and the leaderboard stop working.
- `firestore.rules` — Firestore security rules. Changing this file does nothing by itself:
  if you change it, tell the owner to paste it in Firebase console → Firestore → Rules → Publish.
- `api/chat.js` — Vercel serverless function behind the «الدردشة» page: checks the user's Firebase ID token,
  then asks Google Gemini (free tier) for a reply plus a correction of the learner's last message (JSON).
  Needs the Vercel environment variable `GEMINI_API_KEY` (free key from aistudio.google.com; never put it in
  index.html). Optional `GEMINI_MODEL`. With `mode: "practice"` it returns 5 multiple-choice exercises for one
  grammar lesson instead of a chat reply. Chat history stays in the browser (`lingo:chat:<lang>:<uid>`),
  not in the progress model.
- `README.md` — setup guide in Darija.

## Languages and wording

- Word meanings, example translations and grammar lessons: **Modern Standard Arabic (فصحى)**.
- Interface text (buttons, messages, tips): **Moroccan Darija in Arabic script**.
- The page is right-to-left (`dir="rtl"`). French/German text uses the `.fw` class (LTR).

## Vocabulary data (`var RAW = { fr: `...`, de: `...` }` in index.html)

- Topic header line: `#LEVEL|topic` (LEVEL is A1, A2, B1 or B2). A header without `|` means A1.
- Word line, 6 fields separated by `|`:
  `word|gender|Arabic meaning|pronunciation in Arabic letters|example sentence|Arabic translation of the example`
  - `gender` is `m`, `f`, `n` (German only) or empty for non-nouns.
  - Nouns always include their article: French `Le `, `La `, `L’`; German `Der `, `Die `, `Das `.
  - In the example, wrap the noun in `*stars*` so it is coloured by gender.
- A word's id is its exact text (French) or `"de:" + text` (German). Progress is stored by id,
  so **never rename, re-case or delete an existing word** — only add new ones. No duplicates.
- Cumulative vocabulary targets: A1 600, A2 1,200, B1 2,200, B2 3,800 (`TARGETS`).

## Grammar lessons (`var LESSONS = { fr: [...], de: [...] }` in index.html)

- Each lesson: `{lvl, t: "French title — عنوان", d: explanation (MSA), r: [[example, Arabic, gender?]], tip}`.
  Progress is stored by index (`p.lessons[i]`), so **only append lessons at the end; never reorder or remove**.
- French is a daily course (`DAILY = {fr:3}`, 3 new lessons a day), followed in the order `FR_ORDER`
  (6 basics, then the pronunciation lessons stored at 54-61, then the rest). A lesson opens once the one before it
  in that order is done, while fewer than 3 lessons were done today. Display order can change; stored indexes cannot.
  `p.lessons[i]` is the time it was marked done (`1` for lessons done before times were kept).
  German lessons are unchanged and all open.

## Progress model (do not change the shape without a migration)

Per language (`ST.fr`, `ST.de`): `learned`, `mastered`, `stats`, `xp`, `days`, `quizzes`, `lessons`, `exams`.

- `learned`: the user pressed «حفظتها». Learned words are hidden from flashcards and come back only in quizzes.
  Quizzes and exams ask only about learned words (other words are used only as wrong options);
  an exam opens once 20 words of that level are learned.
- `mastered`: answered correctly in a quiz. Counted once per word; wrong answers never count.
- Saved in localStorage (`lingo:u:<uid>` when signed in) and in Firestore `data/users/{uid}/lingo`.
- Leaderboard: Firestore `scores/{uid}` with `name`, `points`, `points_de`, `xp_fr`, `xp_de`.
- `exams`: one entry per level, `{best, tries, pass, last}`. The exam view («الامتحان») gives 20 mixed questions,
  8 minutes in total, no feedback until the end; 80% passes and shows a certificate (`EXAM` in index.html).
  `exams.all` is the full review («المراجعة الشاملة»): up to 30 questions on every learned word of every level,
  12 minutes, opens at 20 learned words, no certificate (`REVIEW`).
- Daily goal: 10 new learned words; the streak grows only on days that reach it.
- French and German statistics must never be mixed.

## Firebase adapter

The `<head>` loads Firebase (compat SDK from gstatic) and turns it into
`window.claude.use("user" | "db")` plus `window.LINGO_AUTH.signIn/signOut`.
The app code talks only to that interface. Keep it, and keep `window.LINGO_SITE = true`.

## Before finishing a change

1. Check the JavaScript still parses: extract the main `<script>` from `index.html` and run `node --check`.
2. If you added words: check every line has 6 fields, nouns have an article and a gender, and no word is duplicated.
3. Keep the layout working on phones (about 390px wide) and the existing design (white, soft blue/violet).
4. Commit with a short message. Then tell the owner to open the pull request and click
   **Merge pull request**, because Vercel publishes only what is on `main`.
