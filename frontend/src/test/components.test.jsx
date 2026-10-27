import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DriveLinkInput } from "../components/resume/DriveLinkInput.jsx";
import { ProtectedRoute } from "../routes/guards.jsx";
import { useAuthStore } from "../store/authStore.js";

function renderWithClient(ui) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe("ProtectedRoute", () => {
  const renderAt = () => {
    const router = createMemoryRouter(
      [
        { element: <ProtectedRoute />, children: [{ path: "/dashboard", element: <p>Secret dashboard</p> }] },
        { path: "/login", element: <p>Login page</p> },
      ],
      { initialEntries: ["/dashboard"] },
    );
    render(<RouterProvider router={router} />);
  };

  it("waits while the session is being restored", () => {
    useAuthStore.setState({ status: "loading" });
    renderAt();
    expect(screen.getByText(/restoring your session/i)).toBeInTheDocument();
  });

  it("redirects anonymous users to login", () => {
    useAuthStore.setState({ status: "anonymous", user: null, accessToken: null });
    renderAt();
    expect(screen.getByText("Login page")).toBeInTheDocument();
  });

  it("shows the page to authenticated users", () => {
    useAuthStore.setState({ status: "authenticated", user: { name: "A" }, accessToken: "t" });
    renderAt();
    expect(screen.getByText("Secret dashboard")).toBeInTheDocument();
  });
});

describe("DriveLinkInput", () => {
  it("rejects text that is not a URL without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderWithClient(<DriveLinkInput />);
    fireEvent.change(screen.getByLabelText(/google drive link/i), { target: { value: "my resume" } });
    fireEvent.click(screen.getByRole("button", { name: /analyze resume/i }));
    expect(await screen.findByText("Not a valid URL")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the server's message for a private file", async () => {
    useAuthStore.setState({ status: "authenticated", accessToken: "t" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: "NOT_PUBLIC", message: "Not a public viewable resume" } }), { status: 403 }),
      ),
    );
    renderWithClient(<DriveLinkInput />);
    fireEvent.change(screen.getByLabelText(/google drive link/i), {
      target: { value: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view" },
    });
    fireEvent.click(screen.getByRole("button", { name: /analyze resume/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Not a public viewable resume"));
  });

  it("calls onAdded with the analyzed resume", async () => {
    useAuthStore.setState({ status: "authenticated", accessToken: "t" });
    const resume = { id: "r1", profile: { name: "Asha" } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ resume }), { status: 201 })));
    const onAdded = vi.fn();
    renderWithClient(<DriveLinkInput onAdded={onAdded} />);
    fireEvent.change(screen.getByLabelText(/google drive link/i), {
      target: { value: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view" },
    });
    fireEvent.click(screen.getByRole("button", { name: /analyze resume/i }));
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(resume));
  });
});
