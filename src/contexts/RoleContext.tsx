// src/contexts/RoleContext.tsx
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { toast } from "react-toastify";
import { EyeIcon, LockClosedIcon } from "@heroicons/react/24/outline";

type Role = "admin" | "visor" | null;
type RoleContextType = {
  role: Role;
  setRole: (role: Role) => void;
};

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole debe usarse dentro de RoleProvider");
  return context;
};

const RoleProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<Role>(null);
  const [accessPending, setAccessPending] = useState<boolean>(true);
  const [step, setStep] = useState<"choose" | "password">("choose");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const storedAccess = sessionStorage.getItem("accessMode");

    if (storedAccess === "admin") {
      setRole("admin");
      setAccessPending(false);
    } else if (storedAccess === "view") {
      setRole("visor");
      setAccessPending(false);
    }
  }, []);

  const handleAccess = (mode: "view" | "admin") => {
    if (mode === "view") {
      sessionStorage.setItem("accessMode", "view");
      setRole("visor");
      setAccessPending(false);
    } else {
      setStep("password");
    }
  };

  const handlePasswordSubmit = () => {
    if (password === "Borissov@2001") {
      sessionStorage.setItem("accessMode", "admin");
      setRole("admin");
      setAccessPending(false);
    } else {
      toast.error("Clave incorrecta. Acceso como visor.");
      sessionStorage.setItem("accessMode", "view");
      setRole("visor");
      setAccessPending(false);
    }
  };

  if (accessPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--surface-2))] to-[hsl(var(--surface-3))] px-4">
        <div className="app-card shadow-2xl rounded-3xl p-8 sm:p-10 max-w-md w-full space-y-6 relative">
          {/* Logo */}
          <div className="flex justify-center">
            <img
              src="/sl-logo-white.png"
              alt="Sauce League Logo"
              className="w-20 h-20 object-contain drop-shadow"
            />
          </div>

          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[hsl(var(--text-strong))] tracking-tight">
              Acceso al Torneo
            </h1>
            <p className="text-sm text-[hsl(var(--text-subtle))] mt-1">
              Selecciona cómo deseas ingresar
            </p>
          </div>

          {step === "choose" && (
            <div className="space-y-4">
              <button
                onClick={() => handleAccess("view")}
                className="btn-secondary w-full py-3"
              >
                <EyeIcon className="w-5 h-5" />
                Solo ver el torneo
              </button>

              <button
                onClick={() => handleAccess("admin")}
                className="btn-primary w-full py-3"
              >
                <LockClosedIcon className="w-5 h-5" />
                Modo administrador
              </button>
            </div>
          )}

          {step === "password" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-[hsl(var(--text-strong))] text-center">
                  Ingresa la contraseña
                </h2>
                <p className="text-sm text-[hsl(var(--text-subtle))] text-center mt-1">
                  Solo los administradores pueden continuar
                </p>
              </div>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-base"
                placeholder="Contraseña de administrador"
              />

              <button
                onClick={handlePasswordSubmit}
                className="btn-primary w-full py-2.5"
              >
                Ingresar
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
};

export default RoleProvider;
