type SegmentedOption<T extends string> = {
  label: string;
  value: T;
};

type SegmentedControlProps<T extends string> = {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
};

const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  className = "",
}: SegmentedControlProps<T>) => {
  return (
    <div
      className={`inline-flex w-full items-stretch overflow-hidden rounded-md border border-[hsl(var(--border)/0.92)] bg-[hsl(var(--surface-2)/0.86)] p-1 ${className}`.trim()}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`min-h-[44px] flex-1 rounded-sm px-3 text-sm font-semibold transition-all duration-[var(--motion-tab)] ${
              active
                ? "border border-[hsl(var(--primary)/0.45)] bg-[hsl(var(--primary)/0.9)] text-[hsl(var(--primary-foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-1))] hover:text-[hsl(var(--foreground))]"
            }`}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedControl;
