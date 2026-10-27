import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 20_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgres://unused-in-tests",
      JWT_ACCESS_SECRET: "test-access-secret-0123456789abcdefghijklmnop",
      JWT_REFRESH_SECRET: "test-refresh-secret-0123456789abcdefghijklmno",
      INTERNAL_API_KEY: "test-internal-key-0123456789abcdefghijklmnop",
      BCRYPT_COST: "4",
    },
  },
});
