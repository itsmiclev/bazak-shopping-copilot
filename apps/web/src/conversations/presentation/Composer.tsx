import type { RefObject } from "react";
import { MAX_MESSAGE_LENGTH } from "@bazak/shared";
import { Icon } from "../../shared/presentation/Icon";
export function Composer({
  isChat,
  draft,
  onChange,
  onSubmit,
  disabled,
  textRef,
}: {
  isChat: boolean;
  draft: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  textRef: RefObject<HTMLTextAreaElement | null>;
}) {
  return (
    <form
      className={`composer ${isChat ? "chat-composer" : ""}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="composer-input">
        <textarea
          ref={textRef}
          rows={1}
          aria-label="What are you looking for?"
          placeholder={
            isChat
              ? "Tell me a little more…"
              : "What are you looking for today?"
          }
          value={draft}
          maxLength={MAX_MESSAGE_LENGTH}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        <button
          className="send-button"
          type="submit"
          aria-label="Send message"
          disabled={!draft.trim() || disabled}
        >
          <Icon name="arrow" />
        </button>
      </div>
      <div className="composer-bottom">
        <span>
          <Icon name="spark" /> A little conversation. A better find.
        </span>
        <span>Enter to send</span>
      </div>
    </form>
  );
}
