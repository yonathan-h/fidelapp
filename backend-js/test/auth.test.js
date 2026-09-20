import { test, describe, before, after, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { authRouter } from "../src/routes/auth.js";
import { User } from "../src/models/User.js";
import { hashPassword, decodeAccessToken } from "../src/auth.js";

// real express app (mirrors server.js's json + router wiring for the auth routes) listening
// on an ephemeral port, hit with real fetch calls -- avoids pulling in supertest as a
// dependency for what's otherwise a couple of http round trips
let server;
let baseUrl;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/auth", authRouter);
  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      baseUrl = `http://127.0.0.1:${server.address().port}/auth`;
      resolve();
    });
  });
});

after(() => new Promise((resolve) => server.close(resolve)));

// User.findOne/create/save touch a real Postgres connection in production -- every test
// that needs one mocks it here instead, and this clears it so tests can't leak into each other
afterEach(() => mock.restoreAll());

async function postJson(path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

describe("POST /auth/signup", () => {
  test("rejects an invalid username", async () => {
    const { status } = await postJson("/signup", { username: "a", email: "a@example.com", password: "password123" });
    assert.equal(status, 422);
  });

  test("rejects an invalid email", async () => {
    const { status } = await postJson("/signup", { username: "validuser", email: "not-an-email", password: "password123" });
    assert.equal(status, 422);
  });

  test("rejects a password under 8 characters", async () => {
    const { status } = await postJson("/signup", { username: "validuser", email: "a@example.com", password: "short" });
    assert.equal(status, 422);
  });

  test("rejects a duplicate email before ever checking the username", async () => {
    mock.method(User, "findOne", async ({ where }) => (where.email ? { id: 1 } : null));
    const { status, body } = await postJson("/signup", { username: "validuser", email: "taken@example.com", password: "password123" });
    assert.equal(status, 400);
    assert.match(body.detail, /email already exists/);
  });

  test("rejects a duplicate username once the email is free", async () => {
    mock.method(User, "findOne", async ({ where }) => (where.username ? { id: 1 } : null));
    const { status, body } = await postJson("/signup", { username: "taken", email: "new@example.com", password: "password123" });
    assert.equal(status, 400);
    assert.match(body.detail, /username is already taken/);
  });

  test("creates a new user and never echoes the password back", async () => {
    mock.method(User, "findOne", async () => null);
    mock.method(User, "create", async (attrs) => ({ id: 42, username: attrs.username, email: attrs.email }));
    const { status, body } = await postJson("/signup", { username: "validuser", email: "new@example.com", password: "password123" });
    assert.equal(status, 201);
    assert.deepEqual(body, { id: 42, username: "validuser", email: "new@example.com" });
  });
});

describe("POST /auth/login", () => {
  test("rejects non-string credentials without touching the database", async () => {
    const findOne = mock.method(User, "findOne", async () => null);
    const { status, body } = await postJson("/login", {});
    assert.equal(status, 401);
    assert.equal(body.detail, "Incorrect email or password.");
    assert.equal(findOne.mock.callCount(), 0);
  });

  test("an unknown email and a wrong password get the identical generic error", async () => {
    mock.method(User, "findOne", async () => null);
    const unknownEmail = await postJson("/login", { email: "nobody@example.com", password: "password123" });

    mock.restoreAll();
    mock.method(User, "findOne", async () => ({ hashedPassword: hashPassword("correct-password") }));
    const wrongPassword = await postJson("/login", { email: "real@example.com", password: "wrong-password" });

    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.status, 401);
    // anti-enumeration: a bad password and a nonexistent account must not be distinguishable
    assert.equal(unknownEmail.body.detail, wrongPassword.body.detail);
  });

  test("issues a working access token on correct credentials", async () => {
    mock.method(User, "findOne", async () => ({ email: "real@example.com", hashedPassword: hashPassword("correct-password") }));
    const { status, body } = await postJson("/login", { email: "real@example.com", password: "correct-password" });
    assert.equal(status, 200);
    assert.equal(body.token_type, "bearer");
    assert.equal(decodeAccessToken(body.access_token), "real@example.com");
  });
});

describe("POST /auth/verify-email", () => {
  test("rejects a missing token", async () => {
    const { status } = await postJson("/verify-email", {});
    assert.equal(status, 400);
  });

  test("rejects an unknown or expired token", async () => {
    mock.method(User, "findOne", async () => null);
    const { status } = await postJson("/verify-email", { token: "bogus" });
    assert.equal(status, 400);
  });

  test("marks a valid token's user verified and single-uses the token", async () => {
    const user = {
      emailVerified: false,
      verificationToken: "good-token",
      verificationTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
      save: mock.fn(async () => {}),
    };
    mock.method(User, "findOne", async () => user);
    const { status, body } = await postJson("/verify-email", { token: "good-token" });
    assert.equal(status, 200);
    assert.deepEqual(body, { verified: true });
    assert.equal(user.emailVerified, true);
    assert.equal(user.verificationToken, null, "token must be cleared so it can't be replayed");
    assert.equal(user.save.mock.callCount(), 1);
  });
});

describe("anti-enumeration on email-action endpoints", () => {
  test("resend-verification responds identically for an unknown email", async () => {
    mock.method(User, "findOne", async () => null);
    const { status, body } = await postJson("/resend-verification", { email: "nobody@example.com" });
    assert.equal(status, 200);
    assert.match(body.message, /if that account/i);
  });

  test("forgot-password still generates a real reset token for a known email behind the generic response", async () => {
    const user = { save: mock.fn(async () => {}) };
    mock.method(User, "findOne", async () => user);
    const { status, body } = await postJson("/forgot-password", { email: "real@example.com" });
    assert.equal(status, 200);
    assert.match(body.message, /if that account/i);
    assert.equal(user.save.mock.callCount(), 1);
    assert.ok(user.resetToken, "a reset token should have been set on the user");
  });
});

describe("POST /auth/reset-password", () => {
  test("rejects a missing token", async () => {
    const { status } = await postJson("/reset-password", { password: "newpassword123" });
    assert.equal(status, 400);
  });

  test("rejects a password under 8 characters", async () => {
    const { status } = await postJson("/reset-password", { token: "sometoken", password: "short" });
    assert.equal(status, 422);
  });

  test("rejects an invalid or expired token", async () => {
    mock.method(User, "findOne", async () => null);
    const { status } = await postJson("/reset-password", { token: "bogus", password: "newpassword123" });
    assert.equal(status, 400);
  });

  test("updates the password and clears the reset token on a valid token", async () => {
    const user = {
      hashedPassword: hashPassword("old-password"),
      resetToken: "good-token",
      resetTokenExpires: new Date(Date.now() + 60 * 60 * 1000),
      save: mock.fn(async () => {}),
    };
    mock.method(User, "findOne", async () => user);
    const { status, body } = await postJson("/reset-password", { token: "good-token", password: "new-password123" });
    assert.equal(status, 200);
    assert.deepEqual(body, { reset: true });
    assert.equal(user.resetToken, null);
    assert.notEqual(user.hashedPassword, hashPassword("old-password"));
  });
});
