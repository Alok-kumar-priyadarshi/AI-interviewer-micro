import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { bootstrapSession } from "./api/auth.js";
import "./index.css";
import { createAppRouter } from "./router.jsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Client errors (404, validation) won't fix themselves on retry.
      retry: (count, error) => count < 2 && !(error?.status >= 400 && error?.status < 500),
    },
  },
});

// Restore the session from the refresh cookie once, before guards decide where to go.
bootstrapSession();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={createAppRouter()} />
    </QueryClientProvider>
  </StrictMode>,
);
