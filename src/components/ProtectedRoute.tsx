// src/components/ProtectedRoute.tsx
import { Navigate } from "react-router-dom";
import { useRole } from "../contexts/RoleContext";
import type { JSX } from "react";

type Props = {
  children: JSX.Element;
};

const ProtectedRoute = ({ children }: Props) => {
  const { role } = useRole();

  if (role === "admin") {
    return children;
  }

  return <Navigate to="/tournaments" replace />;
};

export default ProtectedRoute;
