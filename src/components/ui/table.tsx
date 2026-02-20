import * as React from "react";

type ClassValue = string | undefined | null | false;
const cn = (...classes: ClassValue[]) => classes.filter(Boolean).join(" ");

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export const TableContainer: React.FC<DivProps> = ({ className, children, ...props }) => (
  <div className={cn("soft-scrollbar overflow-x-auto border bg-[hsl(var(--card)/0.98)]", className)} {...props}>
    {children}
  </div>
);

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => <table ref={ref} className={cn("w-full text-sm", className)} {...props} />
);
Table.displayName = "Table";

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead
      ref={ref}
      className={cn(
        "bg-[hsl(var(--muted)/0.78)] text-[hsl(var(--muted-foreground))] uppercase text-[11px] font-semibold tracking-wide",
        className
      )}
      {...props}
    />
  )
);
TableHeader.displayName = "TableHeader";

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn("divide-y divide-[hsl(var(--border)/0.85)]", className)} {...props} />
);
TableBody.displayName = "TableBody";

export const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tfoot ref={ref} className={cn("bg-[hsl(var(--muted)/0.84)]", className)} {...props} />
);
TableFooter.displayName = "TableFooter";

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "transition-colors duration-[var(--motion-hover)] hover:bg-[hsl(var(--muted)/0.58)]",
        className
      )}
      {...props}
    />
  )
);
TableRow.displayName = "TableRow";

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <th ref={ref} className={cn("px-3 py-2.5 text-left font-semibold", className)} {...props} />
);
TableHead.displayName = "TableHead";

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <td ref={ref} className={cn("px-3 py-2.5 align-middle", className)} {...props} />
);
TableCell.displayName = "TableCell";

export const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => <caption ref={ref} className={cn("mt-2 text-sm text-[hsl(var(--muted-foreground))]", className)} {...props} />
);
TableCaption.displayName = "TableCaption";
