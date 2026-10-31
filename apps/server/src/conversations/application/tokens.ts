export const SHOPPING_AGENT = Symbol("ShoppingAgent");
export const SERVER_OPTIONS = Symbol("ServerOptions");
export interface ServerOptions {
  available?: () => boolean;
  pollMs?: number;
}
