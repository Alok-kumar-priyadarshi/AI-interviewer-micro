import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgres://unused-in-tests",
      GROQ_API_KEY: "gsk_test_key_unused",
      INTERNAL_API_KEY: "test-internal-key-0123456789abcdefghijklmnop",
    },
  },
});
