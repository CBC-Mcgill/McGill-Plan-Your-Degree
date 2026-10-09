import { cn } from "cn";
import type * as React from "react";
import { Tooltip } from "@/components/ui/tooltip";

/**
 * Views of one panel, such as Browse views or What's next terms. Arrow keys, Home and End move between tabs.
 * Each tab's id is `${panelId}-${tab.id}`, so the panel can take `id={panelId}` and `aria-labelledby` the selected tab.
 */
function ViewTabs<T extends string>({
  label,
  tabs,
  value,
  onChange,
  panelId,
}: {
  label: string;
  tabs: { id: T; label: string; tip?: string }[];
  value: T;
  onChange: (id: T) => void;
  panelId: string;
}) {
  function move(event: React.KeyboardEvent<HTMLDivElement>) {
    const n = tabs.length;
    const at = tabs.findIndex((tab) => tab.id === value);
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
    onChange(tab.id);
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
        const selected = tab.id === value;
        const button = (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${panelId}-${tab.id}`}
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            data-label={tab.label}
            className={cn(
              "steady-width h-9 rounded-md px-3",
              selected ? "selected" : "text-fg-muted hover:text-fg",
            )}
          >
            {tab.label}
          </button>
        );
        return tab.tip ? (
          <Tooltip key={tab.id} content={tab.tip}>
            {button}
          </Tooltip>
        ) : (
          button
        );
      })}
    </div>
  );
}

export { ViewTabs };
