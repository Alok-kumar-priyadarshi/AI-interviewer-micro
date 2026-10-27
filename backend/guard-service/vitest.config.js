import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      NODE_ENV: "test",
      GROQ_API_KEY: "gsk_test_key_unused",
      INTERNAL_API_KEY: "test-internal-key-0123456789abcdefghijklmnop",
    },
  },
});
