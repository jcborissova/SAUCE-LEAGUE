import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Bars3Icon,
  HomeIcon,
  UserGroupIcon,
  TrophyIcon,
  PlayIcon,
  CalendarDaysIcon,
  XMarkIcon,
  SunIcon,
  MoonIcon,
} from "@heroicons/react/24/solid";
import { useTheme } from "next-themes";
import logo from "../assets/sl-logo-white.png";
import { useRole } from "../contexts/RoleContext";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  protected: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Inicio", icon: HomeIcon, protected: false },
  { to: "/players", label: "Jugadores", icon: UserGroupIcon, protected: true },
  { to: "/leagues", label: "Ligas", icon: TrophyIcon, protected: true },
  { to: "/matches", label: "Partidos", icon: PlayIcon, protected: true },
  { to: "/tournaments", label: "Torneos", icon: CalendarDaysIcon, protected: false },
];

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { role } = useRole();
  const { theme, setTheme, systemTheme } = useTheme();
  const location = useLocation();

  const currentTheme = (theme === "system" ? systemTheme : theme) ?? "light";
  const isTournamentImmersive = location.pathname.startsWith("/tournaments/view/");
  const visibleNavItems = useMemo(() => NAV_ITEMS.filter((item) => !item.protected || role !== "visor"), [role]);

  const activeSectionLabel = useMemo(() => {
    if (isTournamentImmersive) return "Torneo";

    const match = visibleNavItems
      .slice()
      .sort((a, b) => b.to.length - a.to.length)
      .find((item) => (item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to)));

    return match?.label ?? "Panel";
  }, [isTournamentImmersive, location.pathname, visibleNavItems]);

  const toggleTheme = () => setTheme(currentTheme === "dark" ? "light" : "dark");

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [sidebarOpen]);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <header className="sticky top-0 z-40 border-b border-[hsl(var(--border)/0.9)] bg-[hsl(var(--background)/0.94)] backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background)/0.8)]">
        <div className="flex h-14 w-full items-center gap-2 px-3 sm:h-16 sm:px-4 lg:px-5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[hsl(var(--border))] transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--muted))] lg:hidden"
            aria-label="Abrir menú"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          <NavLink to="/" className="flex items-center gap-2">
            <img src={logo} alt="Sauce League" className="h-8 w-8 border border-[hsl(var(--border))]" />
            <div className="hidden sm:block">
              <p className="text-sm font-semibold leading-tight">Sauce League</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))]">{activeSectionLabel}</p>
            </div>
          </NavLink>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] sm:inline-flex">
              {role === "admin" ? "Admin" : "Visor"}
            </span>
            <button
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[hsl(var(--border))] transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--muted))]"
              aria-label="Cambiar tema"
            >
              {currentTheme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          className="fixed inset-0 z-40 bg-black/42 backdrop-blur-[1px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="relative lg:min-h-[calc(100vh-4rem)] lg:pl-[248px]">
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-4 transition-transform duration-[var(--motion-tab)] lg:top-16 lg:z-30 lg:h-[calc(100vh-4rem)] lg:w-[248px] lg:translate-x-0 lg:border-r lg:border-l-0 lg:border-y-0 lg:bg-[hsl(var(--surface-1))] lg:p-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <p className="text-sm font-semibold">Navegación</p>
            <button
              className="rounded-md p-1 text-[hsl(var(--muted-foreground))] transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
              onClick={() => setSidebarOpen(false)}
              aria-label="Cerrar menú"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div className="hidden border-b px-4 py-4 lg:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
              Navegación
            </p>
          </div>
          <nav className="space-y-1.5 lg:px-3 lg:py-3">
            {visibleNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `group relative flex min-h-[44px] items-center gap-3 px-3 py-2 text-sm font-medium transition-colors duration-[var(--motion-hover)] ${
                    isActive
                      ? "bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/0.84)] hover:text-[hsl(var(--foreground))]"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`absolute inset-y-1 left-0 w-1 transition-colors ${
                        isActive ? "bg-[hsl(var(--primary))]" : "bg-transparent group-hover:bg-[hsl(var(--primary)/0.24)]"
                      }`}
                    />
                    <Icon
                      className={`h-5 w-5 shrink-0 ${
                        isActive ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"
                      }`}
                    />
                    <span className="truncate font-semibold">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 page-reveal px-3 py-3 pb-24 sm:px-4 sm:py-4 sm:pb-24 lg:px-6 lg:py-5 lg:pb-6">
          <div className="mx-auto w-full max-w-[1200px]">
            <Outlet />
          </div>
        </main>
      </div>

      {!isTournamentImmersive ? (
        <nav
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[hsl(var(--border)/0.95)] bg-[hsl(var(--background)/0.97)] px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur lg:hidden"
          aria-label="Navegación principal"
        >
          <ul className="grid grid-cols-5 gap-1">
            {visibleNavItems.slice(0, 5).map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `flex min-h-[50px] flex-col items-center justify-center gap-0.5 px-1 py-1 text-[11px] font-semibold transition-colors duration-[var(--motion-hover)] ${
                      isActive
                        ? "bg-[hsl(var(--primary)/0.12)] text-[hsl(var(--primary))]"
                        : "text-[hsl(var(--muted-foreground))]"
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
};

export default Layout;
