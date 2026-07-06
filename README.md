<div align="center">

# SACRA

**Audio recognition for sacred prayer**

Hold your phone up to any spoken prayer. SACRA transcribes it, finds its meaning, and returns the closest match from 1000+ prayers across 12 world religions within just a few seconds.

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo_SDK_56-000020?style=flat-square&logo=expo&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Fastify](https://img.shields.io/badge/Fastify-000000?style=flat-square&logo=fastify&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)
![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat-square&logo=openai&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-0B0D0E?style=flat-square&logo=railway&logoColor=white)

</div>

---

## Demo

> **[▶ Watch the 90-second demo](#)**

---

## What it does

SACRA is a cross-platform mobile app that listens to a spoken prayer and identifies it. You open the app, tap record, hold it near anyone speaking (in any language) and it surfaces the matching prayer with its full text, source, and thematically related prayers from other religions.

It was built as a portfolio project to demonstrate how modern AI tools (speech recognition, vector embeddings, semantic search) can be wired together into a real, usable product.

---

## The hard part

Prayer recognition is harder than it sounds:

- **Prayers are short.** Most are 1–3 sentences. There isn't much signal to work with.
- **Languages don't match.** A user might speak in Arabic, but the prayer database is indexed in English. Searching Arabic text against English embeddings gives weak results.
- **Meaning matters more than words.** Song recognition apps match exact acoustic fingerprints. SACRA has to match _meaning_: a paraphrase of the Lord's Prayer should still find the Lord's Prayer.

---

## How it works

```
1. User taps record and speaks (or holds phone near someone speaking)

2. Audio is sent to the API every 7 seconds as it records
   → Whisper-1 transcribes each chunk and detects the language
   → Transcribed words appear on screen in real time

3. When recording stops:
   → If the speech was non-English, it's translated to English first
      (the prayer database is indexed in English, which is critical)
   → The English text is embedded into a 1536-dimension vector
   → A hybrid search (vector similarity + full-text) finds the best matches

4. Results are displayed in the user's chosen language
   → Translations are cached locally so switching languages is instant
```

---

## Under the hood

### Hybrid search

A pure vector search isn't good enough for short liturgical text. "Forgive us our trespasses" scores high on keyword search (BM25) but might miss a paraphrase. Embedding search handles paraphrases but can miss exact phrases. SACRA uses both, combined with **Reciprocal Rank Fusion**: a technique that merges two ranked lists by rewarding anything that ranks well under _either_ method.

```sql
-- A document that ranks #3 in vector search and #8 in keyword search
-- scores higher than one that ranks #1 in only one of them.
SELECT ...,
  (1.0 / (60 + vector_rank) + 1.0 / (60 + fts_rank)) AS rrf_score
FROM vector_results
FULL OUTER JOIN keyword_results USING (id)
ORDER BY rrf_score DESC
```

### Multilingual recognition

The biggest technical challenge: the prayer database is in English, but users speak in Spanish, Farsi, Hindi, and 17 other languages. Embedding Spanish speech and comparing it to English prayer embeddings produces poor results because the two languages map to different regions of vector space.

The fix: after recording stops, if the speech was non-English, it gets translated to English via GPT-4o-mini _before_ the embedding search. This bridges the language gap and dramatically improves match accuracy.

Meanwhile, each 7-second audio chunk is sent to Whisper with the detected language from the previous chunk. This "language hint" keeps Whisper stable and prevents it from switching mid-recording.

### Translation caching

The app supports reading all prayers in 20 languages. Naively translating 50 prayers on every language switch would be slow and expensive. Two things make it fast:

- **Title-only mode**: List views only translate the prayer title (~50 chars). The full text translates only when you open a prayer. That's ~10× less text per switch.
- **Persistent cache**: Translations are stored in memory and written to the device after each batch. The next time you switch to the same language, it's instant and no API call is needed.

### Community submissions

Users can submit prayers from any tradition. When a prayer is submitted, GPT-4o-mini validates it ("Is this a genuine prayer from any world religion?") before it ever reaches a human moderator. If valid, it's automatically embedded and added to the searchable database immediately. If not, the user gets a clear rejection reason. Invalid AI responses are caught and safely queued rather than auto-approved.

### Security

- User IDs are always derived from the verified JWT on the server, never trusted from the request body
- Database rows (saved prayers, listen history) are protected by Supabase Row-Level Security so users can only access their own data
- The translation endpoint validates the target language against a hardcoded allowlist before calling GPT, blocking prompt injection via the language field
- Input length is enforced server-side on all text fields

---

## Tech stack

|                | Technology                     | What it's used for                           |
| -------------- | ------------------------------ | -------------------------------------------- |
| Mobile         | React Native + Expo SDK 56     | Cross-platform iOS + Android app             |
| Audio          | expo-audio                     | M4A recording at 44.1kHz                     |
| Transcription  | OpenAI Whisper-1               | Speech-to-text in 90+ languages              |
| Embeddings     | text-embedding-ada-002         | Converting text to 1536-dim semantic vectors |
| Search         | pgvector + PostgreSQL FTS      | Hybrid vector + keyword search with RRF      |
| Database       | Supabase                       | Postgres + Auth + Row-Level Security         |
| Translation    | GPT-4o-mini                    | Batch prayer translation in 20 languages     |
| Backend        | Node.js + Fastify + TypeScript | REST API, audio upload handling              |
| Auth           | Supabase Auth                  | Email + Google OAuth; guest mode             |
| Offline        | expo-sqlite                    | Saved prayers work without internet          |
| API deploy     | Railway                        | Auto-deploys from `main`                     |
| App deploy     | Expo EAS Build                 | Cloud builds for Android + iOS               |
| Analytics      | PostHog                        | Listen, search, and save event tracking      |
| Cost dashboard | Vercel                         | Public page showing real API spend           |

---

## Religions covered

Christianity · Islam · Judaism · Hinduism · Buddhism · Sikhism · Baháʼí Faith · Zoroastrianism · Jainism · Taoism · Shinto · Indigenous / Animist

---

## Languages supported

English · Spanish · French · German · Italian · Portuguese · Russian · Arabic · Hebrew · Hindi · Urdu · Farsi · Turkish · Japanese · Chinese · Korean · Bengali · Indonesian · Swahili · Greek

---

## Cost transparency

Every Whisper and embedding call is logged with its duration, token count, and USD cost. A public dashboard (deployed to Vercel) shows the real monthly running cost of the app.

---

## Running locally

**You'll need:** Node.js 20+, a Supabase project with pgvector enabled, and an OpenAI API key.

```bash
# Install
git clone https://github.com/YOUR_USERNAME/sacra.git
cd sacra/apps/api && npm install
cd ../mobile && npm install

# Configure — create apps/api/.env with:
# SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY, OPENAI_API_KEY

# Seed the database
cd scripts && node seed.js

# Run
cd apps/api && npm run dev       # Terminal 1
cd apps/mobile && npx expo start # Terminal 2
```

<details>
<summary>Full API reference</summary>

| Method | Path                         | Description                                                    |
| ------ | ---------------------------- | -------------------------------------------------------------- |
| `GET`  | `/health`                    | Healthcheck                                                    |
| `GET`  | `/api/prayers`               | Paginated list with religion, language, mood, occasion filters |
| `GET`  | `/api/prayers/religions/all` | All 12 religions                                               |
| `GET`  | `/api/prayers/:id`           | Single prayer                                                  |
| `GET`  | `/api/prayers/:id/similar`   | Cross-faith similar prayers                                    |
| `POST` | `/api/search`                | Hybrid semantic + keyword search                               |
| `POST` | `/api/listen/transcribe`     | Transcribe one audio chunk (real-time)                         |
| `POST` | `/api/listen`                | Transcribe full recording + search                             |
| `POST` | `/api/translate`             | Batch translate up to 200 texts                                |
| `POST` | `/api/community/submit`      | Submit a prayer (AI-validated)                                 |
| `GET`  | `/api/community/queue`       | Admin: moderation queue                                        |
| `POST` | `/api/community/:id/approve` | Admin: approve + embed                                         |
| `POST` | `/api/community/:id/reject`  | Admin: reject                                                  |
| `GET`  | `/api/dashboard/costs`       | Monthly cost breakdown                                         |
| `GET`  | `/api/dashboard/stats`       | Prayer count, total listens                                    |

</details>

---

## Author

**Bahar Abdi**  
[LinkedIn](https://www.linkedin.com/in/bahar-abdi-2a2ab7389) · [bahar.abdi04@gmail.com](mailto:bahar.abdi04@gmail.com)

---

<div align="center">
<sub>many voices · one light</sub>
</div>
