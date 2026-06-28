"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  getPantry,
  getContext,
  saveContext,
  getTodayDecision,
  saveDecision,
  getRecentMeals,
  getExpiringItems,
  clearTodayDecision,
} from "@/lib/pantry";
import { generateDecision } from "@/lib/decision-engine";
import type { PantryItem, UserContext, DinnerDecision, DinnerOption } from "@/lib/types";
import OptionCard from "@/components/OptionCard";
import ContextSheet from "@/components/ContextSheet";
import SwiggyExecutor from "@/components/SwiggyExecutor";
import AddressBar from "@/components/AddressBar";

type PageState = "loading" | "context-needed" | "generating" | "ready";

const TIME_LABELS: Record<string, string> = {
  quick: "< 15 min",
  regular: "30 min",
  relaxed: "1 hr+",
};

const ENERGY_LABELS: Record<string, string> = {
  tired: "😪 Tired",
  normal: "😊 Normal",
  energetic: "💪 Energetic",
};

export default function Home() {
  const [state, setState] = useState<PageState>("loading");
  const [decision, setDecision] = useState<DinnerDecision | null>(null);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [expiringItems, setExpiringItems] = useState<PantryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [executingOption, setExecutingOption] = useState<DinnerOption | null>(null);

  const generateAndSet = useCallback(
    async (ctx: UserContext, pantryData: PantryItem[]) => {
      setState("generating");
      setError(null);
      try {
        const recentMeals = getRecentMeals(7);
        const d = await generateDecision(pantryData, recentMeals, ctx);
        saveDecision(d);
        setDecision(d);
        setState("ready");
      } catch (err) {
        setError(
          (err as Error).message || "Could not generate decision. Check your API key."
        );
        setState("context-needed");
      }
    },
    []
  );

  useEffect(() => {
    const pantryData = getPantry();
    setPantry(pantryData);
    setExpiringItems(getExpiringItems(2));

    const existingDecision = getTodayDecision();
    if (existingDecision) {
      setDecision(existingDecision);
      setState("ready");
      return;
    }

    const ctx = getContext();
    if (ctx) {
      generateAndSet(ctx, pantryData);
    } else {
      setState("context-needed");
    }
  }, [generateAndSet]);

  const handleContextSubmit = (ctx: Omit<UserContext, "savedAt">) => {
    const saved = saveContext(ctx);
    generateAndSet(saved, pantry);
  };

  const handleRefresh = () => {
    clearTodayDecision();
    setState("context-needed");
  };

  return (
    <main className="min-h-screen bg-swiggy-light-gray pb-10">
      {/* Header */}
      <header className="bg-white border-b border-swiggy-border px-4 py-3 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-swiggy-dark tracking-tight leading-none">
              dinner<span className="text-swiggy-orange">OS</span>
            </h1>
            <AddressBar />
          </div>
          <Link
            href="/pantry"
            className="text-xs text-swiggy-orange font-extrabold border-2 border-swiggy-orange rounded-full px-3 py-1.5"
          >
            Pantry {pantry.length > 0 ? `(${pantry.length})` : ""}
          </Link>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-3">
        {/* Expiry alert */}
        {state === "ready" && expiringItems.length > 0 && (
          <div className="bg-swiggy-yellow-light border border-swiggy-yellow/40 rounded-2xl p-3 flex items-start gap-2.5">
            <span className="text-base leading-none mt-0.5">⚠️</span>
            <div>
              <p className="text-xs font-extrabold text-swiggy-dark">
                Use these soon
              </p>
              <p className="text-xs text-swiggy-gray mt-0.5">
                {expiringItems.map((i) => i.name).join(", ")} — used in your
                recommendation
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {state === "loading" && (
          <div className="flex items-center justify-center py-28">
            <div className="w-7 h-7 border-2 border-swiggy-orange border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Generating */}
        {state === "generating" && (
          <div className="text-center py-28">
            <div className="w-7 h-7 border-2 border-swiggy-orange border-t-transparent rounded-full animate-spin mx-auto mb-5" />
            <p className="text-sm font-extrabold text-swiggy-dark">
              Deciding your dinner...
            </p>
            <p className="text-xs text-swiggy-gray mt-1.5">
              {pantry.length > 0
                ? `Checking ${pantry.length} pantry item${pantry.length > 1 ? "s" : ""}`
                : "Analyzing your context"}
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3">
            <p className="text-xs font-semibold text-red-600">{error}</p>
          </div>
        )}

        {/* Ready */}
        {state === "ready" && decision && (
          <>
            {/* Context bar */}
            <div className="bg-white rounded-2xl px-4 py-3 border border-swiggy-border flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xs font-semibold text-swiggy-dark">
                  ⏱ {TIME_LABELS[decision.contextUsed.timeAvailable]}
                </span>
                <span className="text-xs font-semibold text-swiggy-dark">
                  ₹{decision.contextUsed.budget}
                </span>
                <span className="text-xs font-semibold text-swiggy-dark">
                  {ENERGY_LABELS[decision.contextUsed.energy]}
                </span>
              </div>
              <button
                onClick={handleRefresh}
                className="text-xs text-swiggy-orange font-extrabold ml-2"
              >
                Change
              </button>
            </div>

            <OptionCard
              option={decision.option1}
              rank={1}
              onExecute={setExecutingOption}
            />
            <OptionCard
              option={decision.option2}
              rank={2}
              onExecute={setExecutingOption}
            />
            <OptionCard
              option={decision.option3}
              rank={3}
              onExecute={setExecutingOption}
            />

            <p className="text-center text-xs text-swiggy-gray pt-1">
              Decision refreshes tomorrow ·{" "}
              <button
                onClick={handleRefresh}
                className="text-swiggy-orange font-semibold"
              >
                Regenerate
              </button>
            </p>
          </>
        )}
      </div>

      {/* Context sheet */}
      {state === "context-needed" && (
        <ContextSheet onSubmit={handleContextSubmit} />
      )}

      {/* Swiggy executor */}
      {executingOption && (
        <SwiggyExecutor
          option={executingOption}
          onClose={() => setExecutingOption(null)}
        />
      )}
    </main>
  );
}
