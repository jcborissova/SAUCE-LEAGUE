// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import Layout from "./components/Layout";
import ThemeProvider from "./components/ThemeProvider";
import Players from "./pages/Players";
import Leagues from "./pages/Leagues";
import Matches from "./pages/Matches";
import Home from "./pages/Home";
import Tournaments from "./pages/tournaments";
import TournamentViewPage from "./components/Tournaments/TournamentViewPage";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import RoleProvider from "./contexts/RoleContext";
import ProtectedRoute from "./components/ProtectedRoute";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <RoleProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="players" element={<ProtectedRoute><Players /></ProtectedRoute>} />
              <Route path="leagues" element={<ProtectedRoute><Leagues /></ProtectedRoute>} />
              <Route path="matches" element={<ProtectedRoute><Matches /></ProtectedRoute>} />
              <Route path="tournaments" element={<Tournaments />} /> {/* esta puede ser pública */}
              <Route path="tournaments/view/:id" element={<TournamentViewPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
          <ToastContainer position="top-right" autoClose={3000} theme="colored" />
        </Router>
      </RoleProvider>
    </ThemeProvider>
  </React.StrictMode>
);
