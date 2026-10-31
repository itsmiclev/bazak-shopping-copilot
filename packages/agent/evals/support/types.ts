import type { Message, Product, SearchState } from "@bazak/shared";
export type EvalCase = {
  name: string;
  input: string;
  expected: string;
  history?: Message[];
  noSearch?: boolean;
  mustSearch?: boolean;
  expectedCandidateIds?: number[];
  expectedPresentedIds?: number[];
  requiredSearchCategories?: string[];
  check?: (observation: Observation) => string[];
};

export interface Observation {
  text: string;
  products: Product[];
  candidates: Product[];
  searches: SearchState[];
  calls: { name: string; args: unknown }[];
  retrievalResults: unknown[];
}
export interface EvalResult extends Observation {
  passed: boolean;
  history: Message[];
}
export type ExecuteCase = (test: EvalCase) => Promise<EvalResult>;
export type ReportFailure = (detail: Record<string, unknown>) => void;
