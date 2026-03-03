import React, { Fragment, useMemo } from "react";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Transition,
} from "@headlessui/react";
import { CheckIcon, ChevronUpDownIcon } from "@heroicons/react/20/solid";

type PrimitiveValue = string | number;

type NativeLikeChangeEvent<T extends PrimitiveValue> = {
  target: {
    value: T;
  };
};

type ParsedOption<T extends PrimitiveValue> = {
  key: React.Key;
  value: T;
  label: React.ReactNode;
  disabled: boolean;
};

type AppSelectProps<T extends PrimitiveValue> = {
  value: T;
  onChange: (event: NativeLikeChangeEvent<T>) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
};

const stripNativeSelectClasses = (className: string) =>
  className
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => token !== "input-base" && token !== "select-base")
    .join(" ");

const extractOptionValue = (rawValue: unknown, fallbackLabel: React.ReactNode): PrimitiveValue => {
  if (typeof rawValue === "string" || typeof rawValue === "number") {
    return rawValue;
  }

  if (typeof fallbackLabel === "string" || typeof fallbackLabel === "number") {
    return fallbackLabel;
  }

  return "";
};

const AppSelect = <T extends PrimitiveValue>({
  value,
  onChange,
  children,
  className = "",
  disabled = false,
  id,
  "aria-label": ariaLabel,
}: AppSelectProps<T>) => {
  const parsedOptions = useMemo<ParsedOption<T>[]>(() => {
    return React.Children.toArray(children)
      .filter(React.isValidElement)
      .map((child, index) => {
        const option = child as React.ReactElement<{
          value?: PrimitiveValue;
          disabled?: boolean;
          children?: React.ReactNode;
        }>;

        const label = option.props.children ?? "";
        const optionValue = extractOptionValue(option.props.value, label) as T;

        return {
          key: option.key ?? `opt-${index}`,
          value: optionValue,
          label,
          disabled: Boolean(option.props.disabled),
        };
      });
  }, [children]);

  const selectedOption =
    parsedOptions.find((option) => Object.is(option.value, value)) ?? parsedOptions[0] ?? null;

  const selectedValue = (selectedOption?.value ?? value) as T;
  const selectedLabel = selectedOption?.label ?? "";
  const cleanClassName = stripNativeSelectClasses(className);

  return (
    <Listbox
      value={selectedValue}
      onChange={(nextValue: T) => onChange({ target: { value: nextValue } })}
      disabled={disabled || parsedOptions.length === 0}
    >
      {({ open }) => (
        <div className="relative w-full">
          <ListboxButton
            id={id}
            aria-label={ariaLabel}
            className={`group inline-flex min-h-[44px] w-full items-center justify-between gap-2 rounded-[10px] border border-[hsl(var(--border)/0.92)] bg-[hsl(var(--surface-1))] px-3 py-2.5 text-left text-sm text-[hsl(var(--foreground))] shadow-[0_1px_0_hsl(var(--border)/0.32)] transition-all duration-[var(--motion-hover)] focus:outline-none focus-visible:border-[hsl(var(--primary)/0.55)] focus-visible:ring-2 focus-visible:ring-[hsl(var(--primary)/0.22)] disabled:cursor-not-allowed disabled:opacity-55 ${
              open
                ? "border-[hsl(var(--primary)/0.45)] bg-[hsl(var(--surface-2)/0.8)] shadow-[0_6px_18px_hsl(var(--background)/0.12)]"
                : "hover:border-[hsl(var(--primary)/0.28)] hover:bg-[hsl(var(--surface-2)/0.72)]"
            } ${cleanClassName}`.trim()}
          >
            <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
            <ChevronUpDownIcon
              className={`h-5 w-5 shrink-0 text-[hsl(var(--text-subtle))] transition-transform duration-[var(--motion-tab)] ${
                open ? "rotate-180 text-[hsl(var(--primary))]" : ""
              }`}
              aria-hidden="true"
            />
          </ListboxButton>

          <Transition
            as={Fragment}
            show={open}
            enter="transition ease-out duration-150"
            enterFrom="opacity-0 scale-[0.98]"
            enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-120"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-[0.98]"
          >
            <ListboxOptions
              anchor={{ to: "bottom start", gap: 6, padding: 8 }}
              portal
              className="z-[240] w-[var(--button-width)] max-h-[min(44vh,18rem)] overflow-auto rounded-[12px] border border-[hsl(var(--border)/0.85)] bg-[hsl(var(--surface-1)/0.98)] p-1 shadow-[0_16px_40px_hsl(var(--background)/0.22)] ring-1 ring-black/5 backdrop-blur-[8px] soft-scrollbar sm:max-h-72"
            >
              {parsedOptions.map((option) => (
                <ListboxOption
                  key={option.key}
                  value={option.value}
                  disabled={option.disabled}
                  className={({ focus, selected, disabled: optionDisabled }) =>
                    `relative flex min-h-[42px] cursor-pointer items-center gap-2 rounded-[9px] px-3 py-2 text-sm transition-colors ${
                      optionDisabled
                        ? "cursor-not-allowed opacity-45"
                        : focus
                          ? "bg-[hsl(var(--surface-2))] text-[hsl(var(--foreground))]"
                          : selected
                            ? "bg-[hsl(var(--primary)/0.10)] text-[hsl(var(--foreground))]"
                            : "text-[hsl(var(--foreground))]"
                    }`
                  }
                >
                  {({ selected }) => (
                    <>
                      <span className={`min-w-0 flex-1 truncate ${selected ? "font-semibold" : "font-medium"}`}>
                        {option.label}
                      </span>
                      <CheckIcon
                        className={`h-4 w-4 shrink-0 text-[hsl(var(--primary))] transition-opacity ${
                          selected ? "opacity-100" : "opacity-0"
                        }`}
                        aria-hidden="true"
                      />
                    </>
                  )}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </Transition>
        </div>
      )}
    </Listbox>
  );
};

export default AppSelect;
