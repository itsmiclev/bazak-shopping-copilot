import type { Message } from "@bazak/shared";
import { ProductCard } from "../../catalog/presentation/ProductCard";
export function MessageRow({ message }: { message: Message }) {
  // Tool results may arrive before the assistant has explained its selection.
  // Older saved messages have no status, so treat them as complete only with text.
  const showProducts =
    message.role === "assistant" &&
    (message.status === "complete" || message.status === undefined) &&
    Boolean(message.text.trim()) &&
    !message.error &&
    Boolean(message.products?.length);
  return (
    <div className={`message ${message.role}`}>
      <div className="message-label">
        {message.role === "assistant" ? (
          <>
            <span className="mini-brand">f</span> finds
          </>
        ) : (
          "You"
        )}
      </div>
      <div className="message-content">
        {message.text ? (
          <p className="message-text">
            {message.text}
            {message.status === "streaming" && <span className="cursor" />}
          </p>
        ) : message.status === "pending" || message.status === "streaming" ? (
          <div className="thinking">
            <span />
            <span />
            <span />
            <span className="thinking-label">Choosing a few good matches…</span>
          </div>
        ) : null}
        {showProducts && (
          <div
            className="product-strip product-reveal"
            aria-label="Product results"
          >
            {message.products?.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
        {message.error && <p className="inline-error">{message.error}</p>}
      </div>
    </div>
  );
}
