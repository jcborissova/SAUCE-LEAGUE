import React, { useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeftIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { ArrowPathIcon, ShieldCheckIcon } from "@heroicons/react/24/solid";
import { toast } from "react-toastify";

import PageShell from "../components/ui/PageShell";
import SectionCard from "../components/ui/SectionCard";
import { useRole } from "../contexts/RoleContext";

type RouteState = {
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
};

const resolveAdminTarget = (state: RouteState | undefined) => {
  const path = state?.from?.pathname ?? "";
  if (!path || !path.startsWith("/") || path.startsWith("/admin")) {
    return "/players";
  }

  const search = state?.from?.search ?? "";
  const hash = state?.from?.hash ?? "";
  return `${path}${search}${hash}`;
};

const AdminAccess: React.FC = () => {
  const { role, isReady, grantAdminAccess, clearAdminAccess } = useRole();
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const targetPath = useMemo(
    () => resolveAdminTarget(location.state as RouteState | undefined),
    [location.state]
  );

  if (!isReady) {
    return (
      <PageShell>
        <div className="w-full py-14 flex items-center justify-center">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
        </div>
      </PageShell>
    );
  }

  if (role === "admin") {
    return <Navigate to={targetPath} replace />;
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim()) {
      toast.warn("Ingresa la contraseña de administrador.");
      return;
    }

    setSubmitting(true);
    const success = grantAdminAccess(password);

    if (success) {
      toast.success("Acceso de administrador habilitado.");
      navigate(targetPath, { replace: true });
      return;
    }

    setSubmitting(false);
    setPassword("");
    toast.error("Contraseña incorrecta.");
  };

  return (
    <PageShell>
      <section className="mx-auto w-full max-w-md space-y-4">
        <SectionCard
          title="Acceso Administrador"
          description="Esta URL es solo para administración. La URL base permanece en modo visor."
        >
          <form className="space-y-3" onSubmit={handleSubmit}>
            <div className="rounded-lg border bg-[hsl(var(--surface-2))] px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-[hsl(var(--text-subtle))]">Ruta solicitada</p>
              <p className="text-sm font-semibold text-[hsl(var(--text-strong))] break-all">{targetPath}</p>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-semibold text-[hsl(var(--text-subtle))]">Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Ingresa la contraseña"
                className="input-base"
                autoFocus
              />
            </label>

            <button type="submit" className="btn-primary w-full" disabled={submitting}>
              <ShieldCheckIcon className="h-4 w-4" />
              {submitting ? "Validando..." : "Entrar como admin"}
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  clearAdminAccess();
                  navigate("/", { replace: true });
                }}
                className="btn-secondary"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Volver al modo visor
              </button>
              <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-[hsl(var(--text-subtle))]">
                <LockClosedIcon className="h-3.5 w-3.5" />
                Ir al home público
              </Link>
            </div>
          </form>
        </SectionCard>
      </section>
    </PageShell>
  );
};

export default AdminAccess;
