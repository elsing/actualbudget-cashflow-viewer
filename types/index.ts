import type { Scenario, ScenarioRow, ScenarioIncome } from "@/lib/finance";

export type { Scenario, ScenarioRow, ScenarioIncome };

export interface AccountObject {
  id: string;
  name: string;
  type: string;
}

export interface Transaction {
  id: string;
  date: string;
  payee: string;
  category: string;
  amount: number;
  account: string;
  isIncome?: boolean;
  transfer_id?: string | null;
  is_child?: boolean;
}

export interface Month {
  month: string;
  income: number;
  expenses: number;
  net: number;
  startBalance: number;
  endBalance: number;
  categories: Record<string, number>;
  transactions: Transaction[];
  accountEndBals?: Record<string, number>;
}

export interface AppData {
  months: Month[];
  categories: string[];
  incomeCategories: string[];
  categoryGroups: CategoryGroup[];
  catGroupMap: Record<string, string>;
  catIdMap: Record<string, string>;
  accountObjects: AccountObject[];
  accounts: string[];
  txsByAccount: Record<string, Record<string, Transaction[]>>;
  startBalances: Record<string, number>;
  accountMonthBals: Record<string, Record<string, { start: number; end: number; net: number; calcEnd: number }>>;
  syncId: string;
}

export interface CategoryGroup {
  id: string;
  name: string;
  is_income?: boolean;
  hidden?: boolean;
  categories?: { id: string; name: string }[];
}

export interface AppState {
  data: AppData;
  scenarios: Scenario[];
  groups: Group[];
  markers: Record<string, "good" | "bad">;
  reconciliations: Record<string, Record<string, number>>;
}

export interface Group {
  id: string;
  name: string;
  color: string;
}

export interface UiState {
  tab: string;
  overviewRange: number;
  overviewCats: string[] | null;
  overviewIncomeCats: string[] | null;
  overviewVis: { income: boolean; expenses: boolean; net: boolean };
  catsRange: number;
  catsVis: Record<string, boolean> | null;
  catsShowGroups: boolean;
  aiRange: number;
  aiCats: string[] | null;
  aiMode: string;
  flowSelMonth: string | null;
  flowSelAccounts: string[] | null;
  flowBalRange: number;
  flowShowProj: boolean;
  // Scenario projection
  scenActiveId:      string | null;
  scenView:          string;
  projScenId:        string | null;
  projStartBal:      number | null;
  projIncomeDay:     number | null;
  projDayOverrides:  Record<string, number>;
  settledDay:        number;
}
