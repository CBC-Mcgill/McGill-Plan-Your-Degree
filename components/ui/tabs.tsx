import { cn } from "cn";

/** Saved views of one list. Tabs never change the content above them. */
function ViewTabs<T extends string>({
  value,
  tabs,
  onChange,
  label,
}: {
  value: T;
  tabs: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex items-center gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md px-3 font-medium text-[13px] transition-colors",
            tab.value === value
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-subtle hover:text-foreground",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="text-faint tabular-nums">
              {tab.count.toLocaleString()}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export { ViewTabs };
