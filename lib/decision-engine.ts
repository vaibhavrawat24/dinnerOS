import type { PantryItem, MealEntry, UserContext, DinnerDecision } from "./types";

const TIME_LABELS = {
  quick: "under 15 minutes",
  regular: "around 30 minutes",
  relaxed: "1 hour or more — happy to cook properly",
};

const ENERGY_LABELS = {
  tired: "tired and low energy — prefer minimal effort",
  normal: "normal energy",
  energetic: "high energy and happy to cook a full meal",
};

export function buildDecisionPrompt(
  pantry: PantryItem[],
  recentMeals: MealEntry[],
  context: UserContext
): string {
  const pantryList =
    pantry.length > 0
      ? pantry
          .map(
            (i) =>
              `- ${i.name}: ${i.quantity}${
                i.expiresInDays !== undefined
                  ? ` (⚠ expires in ${i.expiresInDays} days)`
                  : ""
              }`
          )
          .join("\n")
      : "Empty pantry — user has no ingredients at home.";

  const historyList =
    recentMeals.length > 0
      ? recentMeals
          .slice(0, 7)
          .map((m) => `- ${m.dish} (${m.type}, ${m.date})`)
          .join("\n")
      : "No recent meal history.";

  return `You are a dinner decision engine for an Indian household. Analyze the pantry and context below to recommend the best 3 dinner options for tonight.

PANTRY:
${pantryList}

RECENT MEALS (do not repeat these):
${historyList}

TONIGHT'S CONTEXT:
- Time available: ${TIME_LABELS[context.timeAvailable]}
- Budget for ordering: ₹${context.budget}
- Energy: ${ENERGY_LABELS[context.energy]}

RULES:
1. Prioritize using items expiring within 2 days — mention this in reasoning
2. Never suggest a dish eaten in the last 3 days
3. If energy is "tired", Option 1 should be very fast (<15 min) or ordering-focused
4. Option 1 is ALWAYS type "cook" — suggest a real Indian dinner dish regardless of pantry state. If pantry is empty, list ALL needed ingredients in "missing" (they will be ordered via Instamart). "usesPantry" should be [] if pantry is empty. NEVER use "not feasible" or similar as a dish name.
5. Option 2 must be a realistic Swiggy food delivery suggestion within the budget
6. Option 3 must be a dine-out suggestion at a nearby restaurant
7. All suggestions should be Indian cuisine appropriate for dinner
8. Be specific with dish names — not generic like "rice dish"

Respond with ONLY valid JSON, no explanation, no markdown:
{
  "option1": {
    "type": "cook",
    "dish": "specific dish name",
    "timeMinutes": 20,
    "usesPantry": ["item1", "item2"],
    "missing": ["item3"],
    "reasoning": "one crisp line explaining why this is best tonight"
  },
  "option2": {
    "type": "order",
    "searchQuery": "specific query for swiggy search",
    "maxBudget": 300,
    "reasoning": "one crisp line"
  },
  "option3": {
    "type": "dineout",
    "searchQuery": "specific restaurant type for dineout search",
    "reasoning": "one crisp line"
  }
}`;
}

export async function generateDecision(
  pantry: PantryItem[],
  recentMeals: MealEntry[],
  context: UserContext
): Promise<DinnerDecision> {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pantry, recentMeals, context }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || "Failed to generate decision");
  }

  const data = await res.json();
  return {
    ...data,
    generatedAt: Date.now(),
    contextUsed: context,
  } as DinnerDecision;
}
