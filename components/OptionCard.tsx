"use client";

import type { DinnerOption, CookOption, OrderOption, DineoutOption } from "@/lib/types";

interface Props {
  option: DinnerOption;
  rank: 1 | 2 | 3;
  onExecute: (option: DinnerOption) => void;
}

const TYPE_CONFIG = {
  cook: {
    label: "Cook",
    chipClass: "text-swiggy-green bg-swiggy-green-light",
  },
  order: {
    label: "Order",
    chipClass: "text-swiggy-orange bg-swiggy-orange-light",
  },
  dineout: {
    label: "Dine Out",
    chipClass: "text-purple-600 bg-purple-50",
  },
};

export default function OptionCard({ option, rank, onExecute }: Props) {
  const isBest = rank === 1;
  const cfg = TYPE_CONFIG[option.type];

  const ctaLabel = () => {
    if (option.type === "cook") {
      return (option as CookOption).missing.length > 0
        ? "Order missing items on Instamart →"
        : "I'll start cooking →";
    }
    if (option.type === "order") return "Find on Swiggy →";
    return "Book a table →";
  };

  return (
    <div
      className={`bg-white rounded-2xl border overflow-hidden ${
        isBest ? "border-swiggy-orange shadow-sm" : "border-swiggy-border"
      }`}
    >
      {/* Header strip */}
      <div
        className={`flex items-center justify-between px-4 py-2.5 ${
          isBest ? "bg-swiggy-orange-light" : "bg-swiggy-light-gray"
        }`}
      >
        <div className="flex items-center gap-1.5">
          {isBest && (
            <span className="text-swiggy-orange text-xs font-bold">★</span>
          )}
          <span
            className={`text-xs font-extrabold tracking-wide ${
              isBest ? "text-swiggy-orange" : "text-swiggy-gray"
            }`}
          >
            {isBest ? "BEST MATCH" : `OPTION ${rank}`}
          </span>
        </div>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full ${cfg.chipClass}`}
        >
          {cfg.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 pt-4 pb-4">
        {option.type === "cook" && (
          <CookBody option={option as CookOption} />
        )}
        {option.type === "order" && (
          <OrderBody option={option as OrderOption} />
        )}
        {option.type === "dineout" && (
          <DineoutBody option={option as DineoutOption} />
        )}

        <p className="text-xs text-swiggy-gray mt-2.5 mb-4 leading-relaxed">
          {option.reasoning}
        </p>

        <button
          onClick={() => onExecute(option)}
          className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${
            isBest
              ? "bg-swiggy-orange text-white"
              : "bg-swiggy-light-gray text-swiggy-dark border border-swiggy-border"
          }`}
        >
          {ctaLabel()}
        </button>
      </div>
    </div>
  );
}

function CookBody({ option }: { option: CookOption }) {
  return (
    <div>
      <h3 className="text-lg font-extrabold text-swiggy-dark leading-tight">
        {option.dish}
      </h3>
      <div className="flex items-center gap-3 mt-1.5 mb-3">
        <span className="text-sm text-swiggy-gray">
          🕐 {option.timeMinutes} min
        </span>
        {option.usesPantry.length > 0 && (
          <span className="text-sm text-swiggy-gray">
            · {option.usesPantry.length} pantry item
            {option.usesPantry.length > 1 ? "s" : ""}
          </span>
        )}
      </div>
      {option.missing.length > 0 && (
        <div className="bg-swiggy-yellow-light rounded-xl px-3 py-2 border border-swiggy-yellow/30">
          <span className="text-xs font-bold text-swiggy-dark">
            Missing:{" "}
          </span>
          <span className="text-xs text-swiggy-gray">
            {option.missing.join(", ")}
          </span>
        </div>
      )}
    </div>
  );
}

function OrderBody({ option }: { option: OrderOption }) {
  return (
    <div>
      <h3 className="text-lg font-extrabold text-swiggy-dark leading-tight capitalize">
        {option.searchQuery}
      </h3>
      <div className="flex items-center gap-3 mt-1.5">
        <span className="text-sm text-swiggy-gray">🚗 Delivery</span>
        <span className="text-sm text-swiggy-gray">· ≤ ₹{option.maxBudget}</span>
      </div>
    </div>
  );
}

function DineoutBody({ option }: { option: DineoutOption }) {
  return (
    <div>
      <h3 className="text-lg font-extrabold text-swiggy-dark leading-tight capitalize">
        {option.searchQuery}
      </h3>
      <div className="flex items-center gap-3 mt-1.5">
        <span className="text-sm text-swiggy-gray">🍽️ Dine in</span>
        <span className="text-sm text-swiggy-gray">· Book a table</span>
      </div>
    </div>
  );
}
