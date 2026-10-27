import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgres://unused-in-tests",
      GROQ_API_KEY: "gsk_test_key_unused",
      EMBEDDING_PROVIDER: "none",
      GUARD_SERVICE_URL: "http://127.0.0.1:1",
      INTERNAL_API_KEY: "test-internal-key-0123456789abcdefghijklmnop",
    },
  },
});
