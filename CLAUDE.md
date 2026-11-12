# Lingo — learn French and German in Arabic

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

## Progress model (do not change the shape without a migration)

Per language (`ST.fr`, `ST.de`): `learned`, `mastered`, `stats`, `xp`, `days`, `quizzes`, `lessons`.

- `learned`: the user pressed «حفظتها». Learned words are hidden from flashcards and come back only in quizzes.
- `mastered`: answered correctly in a quiz. Counted once per word; wrong answers never count.
- Saved in localStorage (`lingo:u:<uid>` when signed in) and in Firestore `data/users/{uid}/lingo`.
- Leaderboard: Firestore `scores/{uid}` with `name`, `points`, `points_de`, `xp_fr`, `xp_de`.
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
