# Fidel

Fidel is a web app for practicing Amharic handwriting. It covers 189 characters across all 27 consonant families of the Fidel script, plus curated word/phrase practice, with a tracing guide and a scoring system that checks both the shape of what you drew and the order of your strokes.

Live: https://fidelapp-one.vercel.app

## How it works

Pick a character from the sidebar grid, which doubles as a progress heatmap and is laid out in the real traditional Fidel chart order. A demo plays once showing the character being drawn stroke by stroke at its actual recorded pace, then settles into a faint trace-over guide behind the canvas. Draw your attempt, hit check, and the app tells you if it passed or if you should try again, with specific feedback (wrong stroke count, reversed direction, which part of the shape didn't match).

Scoring compares your strokes against five recorded samples of the correct character rather than just one, using a DTW-averaged consensus shape as the reference. This makes the system more forgiving of normal handwriting variation while still catching attempts that are genuinely wrong.

Word/phrase practice uses one wide canvas holding every letter of the word, each with its own guide, chained into one continuous demo animation; checking splits your strokes back out per letter for scoring.

## Stack

- React frontend, deployed on Vercel
- Node and Express backend, deployed on Render with a managed Postgres database
- JWT based authentication with hashed passwords, email verification, and password reset (via Resend)

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
  scripts/
    regenerate-reference-averages.js   builds reference_data/ from the raw samples
    validate-averaged-references.js    scores the result against real data, catches regressions
    recorder-server.js + recorder-tool.html   local tool for recording new characters

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
