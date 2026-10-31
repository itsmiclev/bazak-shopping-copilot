import { useEffect, useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Message } from "@bazak/shared";
import { MessageRow } from "./MessageRow";
import { Icon } from "../../shared/presentation/Icon";
export function ConversationView({
  messages,
  loading,
  older,
  loadingOlder,
  onLoadOlder,
  composer,
}: {
  messages: Message[];
  loading: boolean;
  older: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => Promise<unknown>;
  composer: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null),
    stickBottom = useRef(true),
    pendingAnchor = useRef<{ height: number; top: number } | null>(null);
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 180,
    overscan: 5,
    getItemKey: (i) => messages[i]?.id ?? i,
  });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const frame = requestAnimationFrame(() => {
      if (pendingAnchor.current) {
        el.scrollTop =
          pendingAnchor.current.top +
          el.scrollHeight -
          pendingAnchor.current.height;
        pendingAnchor.current = null;
      } else if (stickBottom.current) el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [messages]);
  async function loadOlder() {
    if (!older || loadingOlder) return;
    const el = scrollRef.current;
    if (el)
      pendingAnchor.current = { height: el.scrollHeight, top: el.scrollTop };
    await onLoadOlder();
  }
  return (
    <main className="chat">
      <div className="chat-heading">
        <span className="status-dot" />
        <span>Your next good find</span>
        <span className="chat-caption">A conversation worth shopping</span>
      </div>
      <div
        className="message-scroll"
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current;
          if (el) {
            stickBottom.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 100;
            if (el.scrollTop < 100 && !loading) void loadOlder();
          }
        }}
      >
        <div className="message-width">
          {loading && (
            <p className="muted loading-state">Opening your conversation…</p>
          )}
          {older && (
            <button className="load-older" onClick={() => void loadOlder()}>
              ↑ Earlier messages
            </button>
          )}
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: "relative",
              width: "100%",
            }}
          >
            {virtualizer.getVirtualItems().map((item) => (
              <div
                key={item.key}
                data-index={item.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${item.start}px)`,
                }}
              >
                <MessageRow message={messages[item.index]} />
              </div>
            ))}
          </div>
          {!loading && !messages.length && (
            <div className="empty-chat">
              <Icon name="spark" />
              <h2>A fresh start.</h2>
              <p>
                Tell me what you’re looking for. We’ll figure it out together.
              </p>
            </div>
          )}
        </div>
      </div>
      <div className="chat-bottom">
        {composer}
        <p className="fineprint">
          Browse a demo catalog. Prices in USD. No checkout, just discovery.
        </p>
      </div>
    </main>
  );
}
