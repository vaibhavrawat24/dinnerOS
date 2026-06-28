"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getPantry,
  addPantryItem,
  removePantryItem,
} from "@/lib/pantry";
import type { PantryItem } from "@/lib/types";

const QUICK_ADD = [
  "Rice", "Dal", "Paneer", "Onion", "Tomato", "Potato",
  "Garlic", "Ginger", "Curd", "Eggs", "Ghee", "Atta",
  "Oil", "Butter", "Milk", "Chicken", "Cumin", "Coriander",
];

export default function PantryPage() {
  const [items, setItems] = useState<PantryItem[]>([]);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [expiry, setExpiry] = useState("");

  useEffect(() => {
    setItems(getPantry());
  }, []);

  const refresh = () => setItems(getPantry());

  const handleAdd = (quickName?: string) => {
    const n = (quickName || name).trim();
    if (!n) return;
    addPantryItem({
      name: n,
      quantity: qty || "1",
      expiresInDays: expiry ? parseInt(expiry, 10) : undefined,
    });
    setName("");
    setQty("");
    setExpiry("");
    refresh();
  };

  const expiringItems = items.filter(
    (i) => i.expiresInDays !== undefined && i.expiresInDays <= 2
  );
  const okItems = items.filter(
    (i) => !expiringItems.find((e) => e.id === i.id)
  );
  const quickAddFiltered = QUICK_ADD.filter(
    (q) => !items.find((i) => i.name.toLowerCase() === q.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-swiggy-light-gray pb-10">
      {/* Header */}
      <header className="bg-white border-b border-swiggy-border px-4 py-3 sticky top-0 z-10">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Link
            href="/"
            className="text-swiggy-orange font-extrabold text-xl w-8 flex items-center"
          >
            ←
          </Link>
          <div>
            <h1 className="text-base font-extrabold text-swiggy-dark leading-tight">
              Pantry
            </h1>
            <p className="text-xs text-swiggy-gray">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-4 space-y-4">
        {/* Add item card */}
        <div className="bg-white rounded-2xl p-4 border border-swiggy-border">
          <p className="text-xs font-extrabold text-swiggy-gray uppercase tracking-widest mb-3">
            Add item
          </p>

          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Item name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="flex-1 border border-swiggy-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-swiggy-orange text-swiggy-dark placeholder:text-swiggy-gray/60"
            />
            <input
              type="text"
              placeholder="Qty"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-16 border border-swiggy-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-swiggy-orange text-swiggy-dark placeholder:text-swiggy-gray/60 text-center"
            />
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="number"
              placeholder="Expires in (days, optional)"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="flex-1 border border-swiggy-border rounded-xl px-3 py-2.5 text-sm outline-none focus:border-swiggy-orange text-swiggy-dark placeholder:text-swiggy-gray/60"
            />
            <button
              onClick={() => handleAdd()}
              className="bg-swiggy-orange text-white px-5 py-2.5 rounded-xl font-extrabold text-sm"
            >
              Add
            </button>
          </div>

          {/* Quick add chips */}
          {quickAddFiltered.length > 0 && (
            <>
              <p className="text-xs text-swiggy-gray mb-2 font-semibold">
                Quick add
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickAddFiltered.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleAdd(q)}
                    className="text-xs px-3 py-1.5 bg-swiggy-light-gray rounded-full text-swiggy-dark border border-swiggy-border font-medium active:bg-swiggy-border"
                  >
                    + {q}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Expiring section */}
        {expiringItems.length > 0 && (
          <div>
            <p className="text-xs font-extrabold text-swiggy-gray uppercase tracking-widest px-1 mb-2">
              ⚠️ Use soon
            </p>
            <div className="space-y-2">
              {expiringItems.map((item) => (
                <PantryRow
                  key={item.id}
                  item={item}
                  onRemove={(id) => {
                    removePantryItem(id);
                    refresh();
                  }}
                  urgent
                />
              ))}
            </div>
          </div>
        )}

        {/* Main pantry list */}
        {okItems.length > 0 && (
          <div>
            <p className="text-xs font-extrabold text-swiggy-gray uppercase tracking-widest px-1 mb-2">
              In pantry
            </p>
            <div className="space-y-2">
              {okItems.map((item) => (
                <PantryRow
                  key={item.id}
                  item={item}
                  onRemove={(id) => {
                    removePantryItem(id);
                    refresh();
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🥘</div>
            <p className="text-sm font-extrabold text-swiggy-dark">
              Pantry is empty
            </p>
            <p className="text-xs text-swiggy-gray mt-1">
              Add ingredients above to get cook recommendations
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function PantryRow({
  item,
  onRemove,
  urgent,
}: {
  item: PantryItem;
  onRemove: (id: string) => void;
  urgent?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-xl px-4 py-3 flex items-center justify-between border ${
        urgent ? "border-swiggy-yellow" : "border-swiggy-border"
      }`}
    >
      <div>
        <p className="text-sm font-bold text-swiggy-dark">{item.name}</p>
        <p className="text-xs text-swiggy-gray mt-0.5">
          {item.quantity}
          {item.expiresInDays !== undefined && (
            <span
              className={
                urgent ? " · font-semibold text-swiggy-yellow" : " · text-swiggy-gray"
              }
            >
              {item.expiresInDays === 0
                ? " · expires today"
                : ` · ${item.expiresInDays}d left`}
            </span>
          )}
        </p>
      </div>
      <button
        onClick={() => onRemove(item.id)}
        className="text-swiggy-gray text-sm w-8 h-8 flex items-center justify-center rounded-lg hover:text-red-400 hover:bg-red-50 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
