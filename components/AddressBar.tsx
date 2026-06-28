"use client";

import { useState, useEffect } from "react";
import { isAuthenticated } from "@/lib/swiggy-auth";
import {
  getSavedAddress,
  getDeliveryAddresses,
  saveAddress,
  type SwiggyAddress,
} from "@/lib/swiggy-mcp";

export default function AddressBar() {
  const [connected, setConnected] = useState(false);
  const [saved, setSaved] = useState<SwiggyAddress | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [addresses, setAddresses] = useState<SwiggyAddress[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setConnected(isAuthenticated());
    setSaved(getSavedAddress());
    const sync = () => setSaved(getSavedAddress());
    window.addEventListener("dinnerOS:addressChanged", sync);
    return () => window.removeEventListener("dinnerOS:addressChanged", sync);
  }, []);

  const openPicker = async () => {
    setShowPicker(true);
    if (addresses.length > 0) return;
    setLoading(true);
    try {
      const list = await getDeliveryAddresses();
      setAddresses(list);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (addr: SwiggyAddress) => {
    saveAddress(addr);
    setSaved(addr);
    setShowPicker(false);
  };

  if (!connected) return null;

  return (
    <>
      <button
        onClick={openPicker}
        className="flex items-center gap-1 mt-1.5"
      >
        <span className="text-swiggy-orange text-sm">📍</span>
        <span className="text-sm font-bold text-swiggy-dark max-w-[120px] truncate">
          {saved?.label ?? "Set address"}
        </span>
        <svg
          className="w-3.5 h-3.5 text-swiggy-gray flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowPicker(false)}
          />
          <div className="relative bg-white rounded-t-3xl px-5 pt-4 pb-8 max-w-md mx-auto w-full slide-up">
            <div className="w-10 h-1 bg-swiggy-border rounded-full mx-auto mb-4" />
            <h2 className="text-base font-extrabold text-swiggy-dark mb-1">
              Deliver to
            </h2>
            <p className="text-sm text-swiggy-gray mb-4">
              All three options will use this address
            </p>

            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-6 h-6 border-2 border-swiggy-orange border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {addresses.map((addr) => {
                  const isSelected = saved?.id === addr.id;
                  return (
                    <button
                      key={addr.id}
                      onClick={() => handleSelect(addr)}
                      className={`w-full text-left rounded-2xl p-4 border-2 transition-all flex items-center justify-between ${
                        isSelected
                          ? "bg-swiggy-orange-light border-swiggy-orange"
                          : "bg-swiggy-light-gray border-swiggy-border"
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-bold text-swiggy-dark">
                          {addr.label}
                        </p>
                        <p className="text-xs text-swiggy-gray mt-0.5 truncate">
                          {addr.addressText}
                        </p>
                      </div>
                      {isSelected && (
                        <span className="text-swiggy-orange font-extrabold text-base flex-shrink-0">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
