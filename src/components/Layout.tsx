import React, { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  HomeIcon,
  UserGroupIcon,
  TrophyIcon,
  PlayIcon,
} from "@heroicons/react/24/solid";
import logo from "../assets/sl-logo-white.png";

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen flex bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`sticky top-0 h-screen bg-blue-950 text-white flex flex-col py-6 transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-20"
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-center px-4 mb-10">
          {sidebarOpen ? (
            <h1 className="text-xl font-bold tracking-wide">Sauce League</h1>
          ) : (
            <img src={logo} alt="Logo" className="w-12 h-12 object-contain" />
          )}
        </div>

        {/* Menu */}
        <nav className="flex flex-col gap-4 px-2">
          <Link
            to="/"
            className={`flex items-center gap-3 rounded-md py-2 px-3 hover:bg-blue-800 transition ${
              sidebarOpen ? "justify-start" : "justify-center"
            }`}
          >
            <HomeIcon className="h-6 w-6" />
            <span className={`${sidebarOpen ? "inline-block" : "hidden"}`}>Home</span>
          </Link>

          <Link
            to="/players"
            className={`flex items-center gap-3 rounded-md py-2 px-3 hover:bg-blue-800 transition ${
              sidebarOpen ? "justify-start" : "justify-center"
            }`}
          >
            <UserGroupIcon className="h-6 w-6" />
            <span className={`${sidebarOpen ? "inline-block" : "hidden"}`}>Players</span>
          </Link>

          <Link
            to="/leagues"
            className={`flex items-center gap-3 rounded-md py-2 px-3 hover:bg-blue-800 transition ${
              sidebarOpen ? "justify-start" : "justify-center"
            }`}
          >
            <TrophyIcon className="h-6 w-6" />
            <span className={`${sidebarOpen ? "inline-block" : "hidden"}`}>Leagues</span>
          </Link>

          <Link
            to="/matches"
            className={`flex items-center gap-3 rounded-md py-2 px-3 hover:bg-blue-800 transition ${
              sidebarOpen ? "justify-start" : "justify-center"
            }`}
          >
            <PlayIcon className="h-6 w-6" />
            <span className={`${sidebarOpen ? "inline-block" : "hidden"}`}>Matches</span>
          </Link>
        </nav>
      </aside>

      {/* Content area */}
      <div className="flex-1 min-h-screen relative">
        {/* Toggle button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`absolute top-4 left-4 bg-white text-blue-950 border-2 border-blue-950 rounded-full p-2 shadow-md hover:bg-gray-200 transition-all duration-300`}
        >
          {sidebarOpen ? (
            <ChevronLeftIcon className="h-6 w-6" />
          ) : (
            <ChevronRightIcon className="h-6 w-6" />
          )}
        </button>

        {/* Main Content */}
        <main className="pt-16 px-4 md:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
