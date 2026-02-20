type SegmentedOption<T extends string> = {
  label: string;
  value: T;
};

type SegmentedControlProps<T extends string> = {
  options: Array<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
  scrollable?: boolean;
};

const SegmentedControl = <T extends string>({
  options,
  value,
  onChange,
  className = "",
  scrollable = false,
}: SegmentedControlProps<T>) => {
  return (
    <div
      className={`w-full rounded-[10px] border border-[hsl(var(--border)/0.9)] bg-[hsl(var(--surface-2)/0.85)] p-1 ${
        scrollable ? "flex items-stretch gap-1 overflow-x-auto soft-scrollbar" : "inline-flex items-stretch overflow-hidden"
      } ${className}`.trim()}
    >
      {options.map((option) => {
        const active = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`min-h-[44px] rounded-[7px] px-3 text-sm font-semibold transition-all duration-[var(--motion-tab)] ${
              scrollable ? "flex-none min-w-[114px]" : "flex-1"
            } ${
              active
                ? "border border-[hsl(var(--border)/0.9)] bg-[hsl(var(--surface-1))] text-[hsl(var(--foreground))] shadow-[inset_0_-2px_0_hsl(var(--primary))]"
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
