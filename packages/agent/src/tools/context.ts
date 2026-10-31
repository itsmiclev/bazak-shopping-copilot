import type { AgentCallbacks } from "../application/contracts.js";
import type { createSearchSession } from "../application/search-session.js";
import type { createProductSelection } from "../application/selection.js";
export interface ToolContext {
  session: ReturnType<typeof createSearchSession>;
  selection: ReturnType<typeof createProductSelection>;
  callbacks: AgentCallbacks;
}
