import { useRef, useState } from "react";
import { Icon } from "../shared/presentation/Icon";
import { DiscoveryLanding } from "../catalog/presentation/DiscoveryLanding";
import { Composer } from "../conversations/presentation/Composer";
import { ConversationView } from "../conversations/presentation/ConversationView";
import { HistoryDrawer } from "../conversations/presentation/HistoryDrawer";
import { useConversations } from "../conversations/application/useConversations";
import {
  saveConversation,
  storedConversation,
} from "../conversations/infrastructure/browserState";

export function App() {
  const [active, setActive] = useState<string | null>(storedConversation),
    [drawer, setDrawer] = useState(false),
    [draft, setDraft] = useState(""),
    [sendError, setSendError] = useState("");
  const textRef = useRef<HTMLTextAreaElement>(null),
    activeRef = useRef(active),
    navigationVersion = useRef(0);
  activeRef.current = active;
  const conversations = useConversations(active);
  function select(id: string | null) {
    navigationVersion.current += 1;
    activeRef.current = id;
    setActive(id);
    saveConversation(id);
    setDraft("");
    setSendError("");
    setDrawer(false);
  }
  function newChat() {
    select(null);
    setTimeout(() => textRef.current?.focus(), 0);
  }
  async function send(value = draft) {
    const text = value.trim();
    if (!text || conversations.busy || conversations.sending) return;
    setSendError("");
    let id = active;
    const startedAt = navigationVersion.current;
    try {
      if (!id) {
        const created = await conversations.create();
        id = created.id;
        if (navigationVersion.current === startedAt) select(id);
      }
      if (!id) throw new Error("Could not create a conversation.");
      await conversations.send(id, text);
      if (activeRef.current === id) setDraft("");
    } catch (error) {
      if (activeRef.current === id) {
        setSendError((error as Error).message);
        setDraft(text);
      }
    }
  }
  const composer = (
    <Composer
      isChat={Boolean(active)}
      draft={draft}
      onChange={setDraft}
      onSubmit={() => void send()}
      disabled={conversations.busy || conversations.sending}
      textRef={textRef}
    />
  );
  const error = sendError || conversations.error;
  return (
    <div className={`app ${active ? "chat-mode" : "landing-mode"}`}>
      <header className="topbar">
        <div className="brand-group">
          <button
            className="icon-button"
            aria-label="Open conversation history"
            onClick={() => {
              setDrawer(true);
              void conversations.loadHistory();
            }}
          >
            <Icon name="menu" />
          </button>
          <button className="brand" onClick={newChat}>
            finds<span>✳</span>
          </button>
        </div>
        <span className="header-note">
          GOOD FINDS START WITH A CONVERSATION
        </span>
        <button className="new-button" onClick={newChat}>
          <Icon name="plus" />
          <span>New chat</span>
        </button>
      </header>
      {active ? (
        <ConversationView
          key={active}
          messages={conversations.messages}
          loading={conversations.loading}
          older={conversations.hasOlder}
          loadingOlder={conversations.loadingOlder}
          onLoadOlder={conversations.loadOlder}
          composer={composer}
        />
      ) : (
        <DiscoveryLanding
          composer={composer}
          onSuggest={(text) => void send(text)}
          disabled={conversations.sending}
        />
      )}
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          {sendError && (
            <button aria-label="Dismiss error" onClick={() => setSendError("")}>
              <Icon name="close" />
            </button>
          )}
        </div>
      )}
      {drawer && (
        <HistoryDrawer
          history={conversations.history}
          historyError={conversations.historyError}
          historyCursor={conversations.hasMoreHistory}
          active={active}
          onSelect={select}
          onClose={() => setDrawer(false)}
          onNew={newChat}
          onLoadMore={() => void conversations.loadMoreHistory()}
        />
      )}
    </div>
  );
}
