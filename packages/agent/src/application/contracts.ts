import type { Message, Product, SearchState } from "@bazak/shared";
export interface AgentCallbacks {
  onText(text: string): Promise<void>;
  onProducts(products: Product[]): Promise<void>;
  onCandidates?(products: Product[]): Promise<void>;
  onSearch?(state: SearchState): Promise<void>;
  onRetrievalResult?(result: unknown): void | Promise<void>;
  onToolCall?(name: string, args: unknown): void | Promise<void>;
}
export type RunAgent = (
  messages: Message[],
  callbacks: AgentCallbacks,
) => Promise<void>;
