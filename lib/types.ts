export interface PantryItem {
  id: string;
  name: string;
  quantity: string;
  expiresInDays?: number;
  addedAt: number;
}

export interface MealEntry {
  id: string;
  dish: string;
  type: "cook" | "order" | "dineout";
  date: string;
}

export interface UserContext {
  timeAvailable: "quick" | "regular" | "relaxed";
  budget: "150" | "300" | "500";
  energy: "tired" | "normal" | "energetic";
  savedAt: number;
}

export interface CookOption {
  type: "cook";
  dish: string;
  timeMinutes: number;
  usesPantry: string[];
  missing: string[];
  reasoning: string;
}

export interface OrderOption {
  type: "order";
  searchQuery: string;
  maxBudget: number;
  reasoning: string;
}

export interface DineoutOption {
  type: "dineout";
  searchQuery: string;
  reasoning: string;
}

export type DinnerOption = CookOption | OrderOption | DineoutOption;

export interface DinnerDecision {
  option1: CookOption;
  option2: OrderOption;
  option3: DineoutOption;
  generatedAt: number;
  contextUsed: UserContext;
}

export interface SwiggyAuth {
  accessToken: string;
  expiresAt: number;
}
