# Fidel

Fidel is a web app for practicing Amharic handwriting. It covers the full Fidel script, all 147 characters, with a tracing guide and a scoring system that checks both the shape of what you drew and the order of your strokes.

## How it works

Pick a character from the sidebar. A faint copy of it sits behind the canvas so you can trace over it, the same way kindergarten worksheets teach kids to write the alphabet. Draw your attempt, hit check, and the app tells you if it passed or if you should try again.

Scoring compares your strokes against several recorded samples of the correct character rather than just one. This makes the system more forgiving of normal handwriting variation while still catching attempts that are genuinely wrong.

## Stack

- React frontend
- Node and Express backend
- PostgreSQL for users and practice history
- JWT based authentication with hashed passwords

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
    feedback.js      turns scores into pass or fail
    reference_data/        one recorded sample per character
    reference_data_multi/  five recorded samples per character, used for scoring

frontend/
  src/
    App.jsx          main app and all screens
    api.js           calls to the backend
    useStrokeCanvas.js   captures drawing strokes from the canvas
```

## Notes

Accounts are required so the app can track your progress across characters. Passwords are hashed before they're stored, never saved as plain text. Practice attempts are saved so you can see your history for any character.
