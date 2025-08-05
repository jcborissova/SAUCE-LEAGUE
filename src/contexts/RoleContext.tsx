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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-4">
        <div className="bg-white shadow-2xl rounded-3xl p-8 sm:p-10 max-w-md w-full space-y-6 relative">
          {/* Logo */}
          <div className="flex justify-center">
            <img
              src="/sl-logo-white.png"
              alt="Sauce League Logo"
              className="w-20 h-20 object-contain drop-shadow"
            />
          </div>

          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-900 tracking-tight">
              Acceso al Torneo
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Selecciona cómo deseas ingresar
            </p>
          </div>

          {step === "choose" && (
            <div className="space-y-4">
              <button
                onClick={() => handleAccess("view")}
                className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-xl shadow transition"
              >
                <EyeIcon className="w-5 h-5" />
                Solo ver el torneo
              </button>

              <button
                onClick={() => handleAccess("admin")}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl shadow transition"
              >
                <LockClosedIcon className="w-5 h-5" />
                Modo administrador
              </button>
            </div>
          )}

          {step === "password" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-blue-900 text-center">
                  Ingresa la contraseña
                </h2>
                <p className="text-sm text-gray-500 text-center mt-1">
                  Solo los administradores pueden continuar
                </p>
              </div>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Contraseña de administrador"
              />

              <button
                onClick={handlePasswordSubmit}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white py-2.5 font-semibold rounded-xl shadow transition"
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
