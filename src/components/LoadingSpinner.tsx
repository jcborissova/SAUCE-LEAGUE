import { ArrowPathIcon } from "@heroicons/react/24/solid";

const LoadingSpinner = ({ label = "Cargando..." }: { label?: string }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-[hsl(var(--text-subtle))]">
      <ArrowPathIcon className="h-7 w-7 animate-spin text-[hsl(var(--primary))]" />
      <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
    </div>
  );
};

export default LoadingSpinner;
