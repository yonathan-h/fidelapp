// preloaded via `node --test --import ./test/setup.js` (see package.json) so config.js's
// requireEnv() doesn't throw when auth/db-adjacent modules are imported in tests. No real
// connection is ever opened -- tests that touch User mock its methods directly.
process.env.DATABASE_URL ??= "postgres://test:test@localhost:5432/fidel_test_unused";
process.env.SECRET_KEY ??= "test-only-secret-key";

// force-disabled (not ??=) so tests never place a real call to the Resend API even when
// run on a machine whose local .env has a real key -- config.js's dotenv.config() won't
// override a var that's already set, empty or not, so this wins
process.env.RESEND_API_KEY = "";
