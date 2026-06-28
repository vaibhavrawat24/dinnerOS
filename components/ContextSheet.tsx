"use client";

import { useState } from "react";
import type { UserContext } from "@/lib/types";

interface Props {
  onSubmit: (ctx: Omit<UserContext, "savedAt">) => void;
}

type TimeOption = "quick" | "regular" | "relaxed";
type BudgetOption = "150" | "300" | "500";
type EnergyOption = "tired" | "normal" | "energetic";

const timeOptions: { value: TimeOption; label: string; emoji: string }[] = [
  { value: "quick", label: "< 15 min", emoji: "⚡" },
  { value: "regular", label: "30 min", emoji: "🕐" },
  { value: "relaxed", label: "1 hr+", emoji: "🍳" },
];

const budgetOptions: { value: BudgetOption; label: string }[] = [
  { value: "150", label: "₹150" },
  { value: "300", label: "₹300" },
  { value: "500", label: "₹500+" },
];

const energyOptions: { value: EnergyOption; label: string; emoji: string }[] =
  [
    { value: "tired", label: "Tired", emoji: "😪" },
    { value: "normal", label: "Normal", emoji: "😊" },
    { value: "energetic", label: "Energetic", emoji: "💪" },
  ];

function ChipGroup<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { value: T; label: string; emoji?: string }[];
  selected: T;
  onSelect: (v: T) => void;
}) {
  return (
    <div className="mb-5">
      <p className="text-xs font-bold text-swiggy-gray uppercase tracking-widest mb-2.5">
        {label}
      </p>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onSelect(o.value)}
            className={`flex-1 py-3 rounded-2xl text-sm font-semibold border-2 transition-all ${
              selected === o.value
                ? "bg-swiggy-orange text-white border-swiggy-orange"
                : "bg-white text-swiggy-dark border-swiggy-border"
            }`}
          >
            {o.emoji && <div className="text-base mb-0.5">{o.emoji}</div>}
            <div>{o.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ContextSheet({ onSubmit }: Props) {
  const [time, setTime] = useState<TimeOption>("regular");
  const [budget, setBudget] = useState<BudgetOption>("300");
  const [energy, setEnergy] = useState<EnergyOption>("normal");

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-8 max-w-md mx-auto w-full slide-up">
        <div className="w-10 h-1 bg-swiggy-border rounded-full mx-auto mb-6" />

        <h2 className="text-xl font-extrabold text-swiggy-dark mb-1">
          Tonight&apos;s plan
        </h2>
        <p className="text-sm text-swiggy-gray mb-6">
          Tell us your situation — takes 5 seconds
        </p>

        <ChipGroup
          label="Time available"
          options={timeOptions}
          selected={time}
          onSelect={setTime}
        />
        <ChipGroup
          label="Budget"
          options={budgetOptions}
          selected={budget}
          onSelect={setBudget}
        />
        <ChipGroup
          label="Energy level"
          options={energyOptions}
          selected={energy}
          onSelect={setEnergy}
        />

        <button
          onClick={() =>
            onSubmit({ timeAvailable: time, budget, energy })
          }
          className="w-full bg-swiggy-orange text-white py-4 rounded-2xl font-extrabold text-base mt-2 active:bg-swiggy-orange-dark transition-colors"
        >
          Decide my dinner →
        </button>
      </div>
    </div>
  );
}
