import type { PantryItem, MealEntry, UserContext, DinnerDecision } from "./types";

const KEYS = {
  PANTRY: "dinnerOS_pantry",
  HISTORY: "dinnerOS_history",
  CONTEXT: "dinnerOS_context",
  DECISION: "dinnerOS_decision",
} as const;

export function getPantry(): PantryItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEYS.PANTRY) || "[]");
  } catch {
    return [];
  }
}

function savePantry(items: PantryItem[]): void {
  localStorage.setItem(KEYS.PANTRY, JSON.stringify(items));
}

export function addPantryItem(
  item: Omit<PantryItem, "id" | "addedAt">
): PantryItem {
  const items = getPantry();
  const newItem: PantryItem = {
    ...item,
    id: crypto.randomUUID(),
    addedAt: Date.now(),
  };
  savePantry([...items, newItem]);
  return newItem;
}

export function removePantryItem(id: string): void {
  savePantry(getPantry().filter((i) => i.id !== id));
}

export function getExpiringItems(withinDays = 2): PantryItem[] {
  return getPantry().filter(
    (i) => i.expiresInDays !== undefined && i.expiresInDays <= withinDays
  );
}

export function getMealHistory(): MealEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEYS.HISTORY) || "[]");
  } catch {
    return [];
  }
}

export function addMealEntry(entry: Omit<MealEntry, "id">): void {
  const history = getMealHistory();
  const newEntry: MealEntry = { ...entry, id: crypto.randomUUID() };
  localStorage.setItem(
    KEYS.HISTORY,
    JSON.stringify([newEntry, ...history].slice(0, 30))
  );
}

export function getRecentMeals(days = 7): MealEntry[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return getMealHistory().filter((e) => e.date >= cutoffStr);
}

export function getContext(): UserContext | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEYS.CONTEXT);
    if (!raw) return null;
    const ctx = JSON.parse(raw) as UserContext;
    // Context expires after 4 hours
    if (Date.now() - ctx.savedAt > 4 * 60 * 60 * 1000) return null;
    return ctx;
  } catch {
    return null;
  }
}

export function saveContext(
  ctx: Omit<UserContext, "savedAt">
): UserContext {
  const full: UserContext = { ...ctx, savedAt: Date.now() };
  localStorage.setItem(KEYS.CONTEXT, JSON.stringify(full));
  return full;
}

export function getTodayDecision(): DinnerDecision | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEYS.DECISION);
    if (!raw) return null;
    const decision = JSON.parse(raw) as DinnerDecision;
    const today = new Date().toDateString();
    const decisionDay = new Date(decision.generatedAt).toDateString();
    if (today !== decisionDay) return null;
    return decision;
  } catch {
    return null;
  }
}

export function saveDecision(decision: DinnerDecision): void {
  localStorage.setItem(KEYS.DECISION, JSON.stringify(decision));
}

export function clearTodayDecision(): void {
  localStorage.removeItem(KEYS.DECISION);
}

export function deductPantryItems(usedItems: string[]): void {
  const pantry = getPantry();
  const lower = usedItems.map((u) => u.toLowerCase());
  savePantry(pantry.filter((i) => !lower.includes(i.name.toLowerCase())));
}
