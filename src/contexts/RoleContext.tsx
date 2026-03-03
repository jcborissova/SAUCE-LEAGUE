import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Role = "admin" | "visor" | null;

type RoleContextType = {
  role: Role;
  isReady: boolean;
  setRole: (role: Exclude<Role, null>) => void;
  grantAdminAccess: (password: string) => boolean;
  clearAdminAccess: () => void;
};

const ACCESS_MODE_KEY = "accessMode";
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_ACCESS_PASSWORD ?? "Borissov@2001";

const RoleContext = createContext<RoleContextType | undefined>(undefined);

const getStoredRole = (): Exclude<Role, null> => {
  const stored = sessionStorage.getItem(ACCESS_MODE_KEY);
  return stored === "admin" ? "admin" : "visor";
};

const persistRole = (role: Exclude<Role, null>) => {
  sessionStorage.setItem(ACCESS_MODE_KEY, role === "admin" ? "admin" : "view");
};

export const useRole = () => {
  const context = useContext(RoleContext);
  if (!context) throw new Error("useRole debe usarse dentro de RoleProvider");
  return context;
};

const RoleProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRoleState] = useState<Role>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setRoleState(getStoredRole());
    setIsReady(true);
  }, []);

  const setRole = useCallback((nextRole: Exclude<Role, null>) => {
    persistRole(nextRole);
    setRoleState(nextRole);
  }, []);

  const grantAdminAccess = useCallback((password: string) => {
    const valid = password === ADMIN_PASSWORD;
    if (valid) {
      setRole("admin");
      return true;
    }
    setRole("visor");
    return false;
  }, [setRole]);

  const clearAdminAccess = useCallback(() => {
    setRole("visor");
  }, [setRole]);

  const value = useMemo<RoleContextType>(
    () => ({
      role,
      isReady,
      setRole,
      grantAdminAccess,
      clearAdminAccess,
    }),
    [role, isReady, setRole, grantAdminAccess, clearAdminAccess]
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

export default RoleProvider;
