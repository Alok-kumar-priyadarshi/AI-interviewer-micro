import { createBrowserRouter } from "react-router";
import { AppShell } from "./components/layout/AppShell.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import InterviewRoom from "./pages/InterviewRoom.jsx";
import Landing from "./pages/Landing.jsx";
import { Login, Signup } from "./pages/AuthPages.jsx";
import NewInterview from "./pages/NewInterview.jsx";
import NotFound from "./pages/NotFound.jsx";
import Report from "./pages/Report.jsx";
import Resumes from "./pages/Resumes.jsx";
import { ProtectedRoute, PublicOnlyRoute } from "./routes/guards.jsx";

export const routes = [
  { path: "/", element: <Landing /> },
  {
    element: <PublicOnlyRoute />,
    children: [
      { path: "/login", element: <Login /> },
      { path: "/signup", element: <Signup /> },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: "/dashboard", element: <Dashboard /> },
          { path: "/resumes", element: <Resumes /> },
          { path: "/interviews/new", element: <NewInterview /> },
          { path: "/interviews/:id", element: <InterviewRoom /> },
          { path: "/reports/:sessionId", element: <Report /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFound /> },
];

export const createAppRouter = () => createBrowserRouter(routes);
