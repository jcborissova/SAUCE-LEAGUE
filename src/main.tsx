// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import "./index.css";
import Layout from "./components/Layout";
import Players from "./pages/Players";
import Leagues from "./pages/Leagues";
import Matches from "./pages/Matches";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Navigate } from "react-router-dom";
import Home from "./pages/Home";


ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Router>
      <>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />  {/* <-- agregamos aquí */}
            <Route path="players" element={<Players />} />
            <Route path="leagues" element={<Leagues />} />
            <Route path="matches" element={<Matches />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        <ToastContainer position="top-right" autoClose={3000} />
      </>
    </Router>
  </React.StrictMode>
);
