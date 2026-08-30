// thin wrapper around the backend, one function per route
// token kept in memory, not localStorage -- no persistence across reloads yet

// set VITE_API_BASE_URL in the deployed environment (see .env.example) -- falls back to
// the local dev backend so `npm run dev` keeps working with no env setup
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

function extractErrorMessage(body) {
  // detail is usually a plain string, but validation errors come back as
  // an array of {msg, ...} objects -- without handling both this renders
  // as "[object Object]" in the ui
  if (typeof body.detail === "string") return body.detail;
  if (Array.isArray(body.detail) && body.detail.length > 0) {
    return body.detail.map((e) => e.msg).join("; ");
  }
  return "Something went wrong. Please try again.";
}

async function handleResponse(response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(extractErrorMessage(body));
  }
  return response.json();
}

export async function signup(username, email, password) {
  const response = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  return handleResponse(response);
}

export async function login(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(response); // { access_token, token_type }
}

export async function getCharacters() {
  const response = await fetch(`${API_BASE}/practice/characters`);
  return handleResponse(response); // {romanization, character}[]
}

export async function getWords() {
  const response = await fetch(`${API_BASE}/practice/words`);
  return handleResponse(response); // {text, romanization, meaning, category, chunks}[]
}

export async function submitAttempt(token, romanization, strokes) {
  const response = await fetch(`${API_BASE}/practice/attempt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ romanization, strokes }),
  });
  return handleResponse(response); // { character, romanization, passed, message, messages }
}

export async function getHistory(token, romanization = null) {
  const url = new URL(`${API_BASE}/practice/history`);
  if (romanization) url.searchParams.set("romanization", romanization);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return handleResponse(response);
}

export async function getProgress(token) {
  const response = await fetch(`${API_BASE}/practice/progress`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response);
}

export async function getMe(token) {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse(response); // {id, username, email, email_verified}
}

export async function verifyEmail(token) {
  const response = await fetch(`${API_BASE}/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  return handleResponse(response); // { verified: true }
}

export async function resendVerification(email) {
  const response = await fetch(`${API_BASE}/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse(response); // { message }
}

export async function forgotPassword(email) {
  const response = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse(response); // { message }
}

export async function resetPassword(token, password) {
  const response = await fetch(`${API_BASE}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password }),
  });
  return handleResponse(response); // { reset: true }
}
