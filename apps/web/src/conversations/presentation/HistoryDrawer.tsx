import { useEffect } from "react";
import type { ConversationSummary } from "@bazak/shared";
import { Icon } from "../../shared/presentation/Icon";
export function HistoryDrawer({
  history,
  historyError,
  historyCursor,
  active,
  onSelect,
  onClose,
  onNew,
  onLoadMore,
}: {
  history: ConversationSummary[];
  historyError: string;
  historyCursor: boolean;
  active: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  onNew: () => void;
  onLoadMore: () => void;
}) {
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus();
  }, []);
  return (
    <div className="drawer-overlay" onClick={() => onClose()}>
      <aside
        className="history-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Conversation history"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Tab") {
            const buttons = Array.from(
              e.currentTarget.querySelectorAll<HTMLButtonElement>(
                "button:not(:disabled)",
              ),
            );
            const first = buttons[0],
              last = buttons[buttons.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="drawer-top">
          <span className="brand">
            finds<span>✳</span>
          </span>
          <button
            autoFocus
            className="icon-button"
            aria-label="Close history"
            onClick={() => onClose()}
          >
            <Icon name="close" />
          </button>
        </div>
        <button className="drawer-new" onClick={onNew}>
          <Icon name="plus" /> Start a new find
        </button>
        <h2>Your conversations</h2>
        {historyError && (
          <p role="alert" className="inline-error">
            {historyError}
          </p>
        )}
        <div className="history-list">
          {!history.length && !historyError && (
            <p className="muted">Your good finds will live here.</p>
          )}
          {history.map((c) => (
            <button
              key={c.id}
              className={`history-item ${c.id === active ? "selected" : ""}`}
              onClick={() => {
                onSelect(c.id);
                onClose();
              }}
            >
              <span>{c.title || "A new conversation"}</span>
              <small>
                {new Date(c.updatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </small>
            </button>
          ))}
          {historyCursor && (
            <button className="load-older" onClick={() => onLoadMore()}>
              Load more conversations
            </button>
          )}
        </div>
        <p className="drawer-note">
          Saved for this browser.
          <br />
          Pick up a conversation anytime.
        </p>
      </aside>
    </div>
  );
}
