// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./index.css";
import Layout from "./components/Layout";
import Players from "./pages/Players";
import Leagues from "./pages/Leagues";
import Matches from "./pages/Matches";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="players" element={<Players />} />
          <Route path="leagues" element={<Leagues />} />
          <Route path="matches" element={<Matches />} />
        </Route>
      </Routes>
    </Router>
  </React.StrictMode>
);
