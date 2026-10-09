import { cn } from "cn";
import type * as React from "react";

/** Saved views of one list, switching the one panel below them. Arrow keys, Home and End move between tabs. */
function ViewTabs<T extends string>({
  value,
  tabs,
  onChange,
  label,
  panelId,
}: {
  value: T;
  tabs: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  label: string;
  /** The id of the tabpanel the selected tab controls. */
  panelId: string;
}) {
  function move(event: React.KeyboardEvent<HTMLDivElement>) {
    const n = tabs.length;
    const at = tabs.findIndex((tab) => tab.value === value);
    const to = (
      {
        ArrowRight: (at + 1) % n,
        ArrowLeft: (at + n - 1) % n,
        Home: 0,
        End: n - 1,
      } as Record<string, number>
    )[event.key];
    const tab = to === undefined ? undefined : tabs[to];
    if (to === undefined || !tab || to === at) return;
    event.preventDefault();
    onChange(tab.value);
    event.currentTarget
      .querySelectorAll<HTMLElement>('[role="tab"]')
      [to]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={move}
      className="flex items-center gap-1"
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            id={`${panelId}-${tab.value}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 font-medium text-[13px] transition-colors",
              selected
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
        );
      })}
    </div>
  );
}

export { ViewTabs };
