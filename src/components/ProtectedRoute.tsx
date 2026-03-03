// src/components/ProtectedRoute.tsx
import { Navigate, useLocation } from "react-router-dom";
import { useRole } from "../contexts/RoleContext";
import type { JSX } from "react";
import { ArrowPathIcon } from "@heroicons/react/24/solid";

type Props = {
  children: JSX.Element;
};

const ProtectedRoute = ({ children }: Props) => {
  const { role, isReady } = useRole();
  const location = useLocation();

  if (!isReady || role === null) {
    return (
      <div className="w-full py-14 flex items-center justify-center">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  if (role === "admin") {
    return children;
  }

  return <Navigate to="/admin" replace state={{ from: location }} />;
};

export default ProtectedRoute;
