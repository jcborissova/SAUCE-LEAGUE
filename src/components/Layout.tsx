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
  description: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  protected: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Inicio", description: "Vista general", icon: HomeIcon, protected: false },
  { to: "/players", label: "Jugadores", description: "Roster y perfiles", icon: UserGroupIcon, protected: true },
  { to: "/leagues", label: "Ligas", description: "Equipos y reglas", icon: TrophyIcon, protected: true },
  { to: "/matches", label: "Partidos", description: "Resultados y ritmo", icon: PlayIcon, protected: true },
  { to: "/tournaments", label: "Torneos", description: "Calendario y llaves", icon: CalendarDaysIcon, protected: false },
];

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { role } = useRole();
  const { theme, setTheme, systemTheme } = useTheme();
  const location = useLocation();

  const currentTheme = (theme === "system" ? systemTheme : theme) ?? "light";
  const isTournamentImmersive = location.pathname.startsWith("/tournaments/view/");
  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => !item.protected || role !== "visor"),
    [role]
  );

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
      if (event.key === "Escape") {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [sidebarOpen]);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[22rem] bg-gradient-to-b from-[hsl(var(--primary)/0.22)] via-[hsl(var(--primary)/0.05)] to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-6rem] top-[-5rem] -z-10 h-48 w-48 rounded-full bg-[hsl(var(--info)/0.18)] blur-3xl"
      />

      <header className="sticky top-0 z-50 border-b border-[hsl(var(--border)/0.75)] bg-[hsl(var(--background)/0.9)] backdrop-blur supports-[backdrop-filter]:bg-[hsl(var(--background)/0.7)]">
        <div className="mx-auto flex h-16 w-full max-w-[1480px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(var(--border))] transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--muted))] lg:hidden"
            aria-label="Abrir menú"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>

          <NavLink to="/" className="flex items-center gap-3">
            <img src={logo} alt="Sauce League" className="h-9 w-9 rounded-xl ring-1 ring-black/10 dark:ring-white/20" />
            <div className="hidden sm:block">
              <p className="text-sm font-semibold tracking-tight">Sauce League</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Gestión de competencia</p>
            </div>
          </NavLink>

          <div className="hidden md:flex md:items-center md:rounded-md md:border md:bg-[hsl(var(--muted)/0.52)] md:px-3.5 md:py-1.5">
            <span className="text-xs font-semibold text-[hsl(var(--muted-foreground))]">Sección activa</span>
            <span className="mx-2 h-4 w-px bg-[hsl(var(--border))]" />
            <span className="text-sm font-semibold">{activeSectionLabel}</span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.72)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))] sm:inline-flex">
              {role === "admin" ? "Admin" : "Visor"}
            </span>
            <button
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[hsl(var(--border))] transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--muted))]"
              aria-label="Cambiar tema"
            >
              {currentTheme === "dark" ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      <div
        className={`mx-auto w-full max-w-[1480px] px-4 sm:px-6 lg:px-8 ${
          isTournamentImmersive ? "py-3 sm:py-4 lg:py-5" : "py-6 lg:py-8"
        }`}
      >
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Cerrar menú"
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div
          className={`grid grid-cols-1 gap-5 lg:gap-6 ${
            isTournamentImmersive ? "lg:grid-cols-[252px_minmax(0,1fr)]" : "lg:grid-cols-[272px_minmax(0,1fr)]"
          }`}
        >
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-6 shadow-xl transition-transform duration-[var(--motion-tab)] lg:sticky lg:top-24 lg:z-20 lg:w-auto lg:translate-x-0 lg:rounded-2xl lg:border lg:bg-[hsl(var(--card)/0.9)] lg:p-3 ${
              isTournamentImmersive ? "lg:h-[calc(100vh-6.35rem)]" : "lg:h-[calc(100vh-7.1rem)]"
            } ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
          >
            <div className="mb-6 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <img src={logo} alt="Sauce League" className="h-9 w-9 rounded-xl ring-1 ring-black/10 dark:ring-white/20" />
                <div>
                  <p className="text-sm font-semibold">Navegación</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Accesos principales</p>
                </div>
              </div>
              <button
                className="rounded-lg p-1 text-[hsl(var(--muted-foreground))] transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] lg:hidden"
                onClick={() => setSidebarOpen(false)}
                aria-label="Cerrar menú"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <nav className="space-y-1.5">
              {visibleNavItems.map(({ to, label, description, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-[var(--motion-hover)] ${
                      isActive
                        ? "bg-[hsl(var(--primary)/0.14)] text-[hsl(var(--foreground))] ring-1 ring-[hsl(var(--primary)/0.34)]"
                        : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted)/0.94)] hover:text-[hsl(var(--foreground))]"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <Icon
                        className={`h-5 w-5 shrink-0 ${
                          isActive ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{label}</p>
                        <p
                          className={`truncate text-xs ${
                            isActive
                              ? "text-[hsl(var(--primary))]"
                              : "text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--foreground))]"
                          }`}
                        >
                          {description}
                        </p>
                      </div>
                    </>
                  )}
                </NavLink>
              ))}
            </nav>

            <div className="mt-6 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.58)] p-3 text-xs text-[hsl(var(--muted-foreground))]">
              <p className="font-semibold uppercase tracking-wide">Tip</p>
              <p className="mt-1 leading-relaxed">
                En móvil puedes cerrar este panel tocando fuera del menú o usando la tecla Escape.
              </p>
            </div>
          </aside>

          <main className="min-w-0">
            {isTournamentImmersive ? (
              <div className="page-reveal">
                <Outlet />
              </div>
            ) : (
              <div className="page-reveal min-h-[calc(100vh-9rem)] rounded-2xl border border-[hsl(var(--border)/0.9)] bg-[hsl(var(--card)/0.88)] p-4 sm:p-6 lg:p-8">
                <Outlet />
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
