import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    env: {
      NODE_ENV: "test",
      JWT_ACCESS_SECRET: "test-access-secret-0123456789abcdefghijklmnop",
      INTERNAL_API_KEY: "test-internal-key-0123456789abcdefghijklmnop",
      AUTH_SERVICE_URL: "http://127.0.0.1:1",
      RESUME_SERVICE_URL: "http://127.0.0.1:1",
      INTERVIEW_SERVICE_URL: "http://127.0.0.1:1",
      SPEECH_SERVICE_URL: "http://127.0.0.1:1",
      REPORT_SERVICE_URL: "http://127.0.0.1:1",
    },
  },
});
