# Fidel

[![CI](https://github.com/yonathan-h/fidelapp/actions/workflows/ci.yml/badge.svg)](https://github.com/yonathan-h/fidelapp/actions/workflows/ci.yml)

Fidel is a web app for practicing Amharic handwriting. It covers 189 characters across all 27 consonant families of the Fidel script, plus curated word/phrase practice, with a tracing guide and a scoring system that checks both the shape of what you drew and the order of your strokes.

Live: https://fidelapp-one.vercel.app

## How it works

Pick a character from the sidebar grid, which doubles as a progress heatmap and is laid out in the real traditional Fidel chart order. A demo plays once showing the character being drawn stroke by stroke at its actual recorded pace, then settles into a faint trace-over guide behind the canvas. Draw your attempt, hit check, and the app tells you if it passed or if you should try again, with specific feedback (wrong stroke count, reversed direction, which part of the shape didn't match).

Every character has one reference: a DTW-averaged consensus built from five independently recorded samples of it, rather than any single raw recording. Averaging cancels out each recording's own hand-tremor far better than smoothing one sample could, so this one reference is what the guide is drawn from, what feedback describes deviations against, and what your attempt is scored against for pass/fail -- one source of truth used everywhere, validated against the raw recordings it was built from (`scripts/validate-single-reference-scoring.js`) rather than assumed.

Word/phrase practice uses one wide canvas holding every letter of the word, each with its own guide, chained into one continuous demo animation; checking splits your strokes back out per letter for scoring.

Every character and word has a pronunciation clip (a speaker button next to the tracing demo) generated with Azure Neural TTS, since Fidel is a syllabary and shape alone doesn't teach you how something is said.

## Stack

- React frontend, deployed on Vercel
- Node and Express backend, deployed on Render with a managed Postgres database
- JWT based authentication with hashed passwords, email verification, and password reset (via Resend)
- Pronunciation audio generated with Azure Neural TTS, served as static files

The scoring engine uses dynamic time warping to compare stroke paths and an intersection over union method to compare shapes. Both were built from scratch in JavaScript.

## Running it locally

You need Node.js and PostgreSQL installed.

**Backend**

```
cd backend-js
npm install
```

Create a database and set your environment variables:

```
psql -U postgres -c "CREATE DATABASE fidel_app;"
```

Create a `.env` file in `backend-js` with:

```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/fidel_app
SECRET_KEY=your_own_secret_here
```

Then start the server:

```
npm run dev
```

**Frontend**

```
cd frontend
npm install
npm run dev
```

Open the app at `http://localhost:5173`. Make sure the backend is running first.

## Project structure

```
backend-js/
  src/
    models/         database models for users and attempts
    routes/         auth and practice endpoints
    scoring.js       shape and stroke order scoring
    dtw.js           dynamic time warping implementation
    feedback.js      turns scores into pass or fail messages
    email.js         Resend wrapper for verification/reset emails
    reference_data/        DTW-averaged consensus reference, one file per character
    reference_data_multi/  five raw recorded samples per character
    audio/                 generated pronunciation clips, one mp3 per character and word
  scripts/
    regenerate-reference-averages.js      builds reference_data/ from the raw samples
    validate-averaged-references.js       scores the result against real data, catches regressions
    validate-single-reference-scoring.js  validates the single reference as the pass/fail signal
    recorder-server.js + recorder-tool.html   local tool for recording new characters
    generate-audio.js                     generates audio/ via Azure Neural TTS

frontend/
  src/
    App.jsx              main app and all screens (character/word practice, auth, routing)
    characterFamilies.js  the 27 families in real Fidel chart order (derived from Unicode)
    strokeGeometry.js     stroke smoothing + demo animation timing
    api.js                calls to the backend
    useStrokeCanvas.js    captures drawing strokes from the canvas
```

## Notes

Accounts are required so the app can track your progress across characters. Passwords are hashed before they're stored, never saved as plain text. Practice attempts are saved so you can see your history for any character.
