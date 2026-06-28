import { NextRequest, NextResponse } from "next/server";
import { buildDecisionPrompt } from "@/lib/decision-engine";
import type { PantryItem, MealEntry, UserContext } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { pantry, recentMeals, context } = (await req.json()) as {
      pantry: PantryItem[];
      recentMeals: MealEntry[];
      context: UserContext;
    };

    const prompt = buildDecisionPrompt(pantry, recentMeals, context);

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://dinneros.app",
        "X-Title": "DinnerOS",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("OpenRouter error:", err);
      return NextResponse.json(
        { error: "AI request failed" },
        { status: res.status }
      );
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Could not parse decision from AI response" },
        { status: 500 }
      );
    }

    const decision = JSON.parse(jsonMatch[0]);
    return NextResponse.json(decision);
  } catch (error) {
    console.error("Decision engine error:", error);
    return NextResponse.json(
      { error: "Failed to generate decision" },
      { status: 500 }
    );
  }
}
