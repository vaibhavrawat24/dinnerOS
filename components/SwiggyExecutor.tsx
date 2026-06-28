"use client";

import { useEffect, useState, useCallback } from "react";
import { isAuthenticated, startOAuthFlow } from "@/lib/swiggy-auth";
import * as mcp from "@/lib/swiggy-mcp";
import type {
  DinnerOption,
  CookOption,
  OrderOption,
  DineoutOption,
} from "@/lib/types";

type StepStatus = "pending" | "loading" | "done" | "error";

interface Step {
  id: string;
  label: string;
  status: StepStatus;
}

type Phase =
  | "auth-check"
  | "auth-needed"
  | "pick-address"
  | "running"
  | "select-restaurant"
  | "select-slot"
  | "review-cart"
  | "success"
  | "error";

interface Props {
  option: DinnerOption;
  onClose: () => void;
}

export default function SwiggyExecutor({ option, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("auth-check");
  const [steps, setSteps] = useState<Step[]>([]);
  const [restaurants, setRestaurants] = useState<Record<string, unknown>[]>([]);
  const [slots, setSlots] = useState<Record<string, unknown>[]>([]);
  const [cart, setCart] = useState<{
    addressId: string;
    address?: string;
    itemCount: number;
    total?: string;
    items?: Array<{ name: string; qty: number; mrp?: number }>;
  } | null>(null);
  const [addressList, setAddressList] = useState<mcp.SwiggyAddress[]>([]);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const setStep = useCallback((id: string, status: StepStatus) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s))
    );
  }, []);

  const appendStep = useCallback((step: Step) => {
    setSteps((prev) => [...prev, step]);
  }, []);

  const runInstamartFlow = useCallback(
    async (opt: CookOption) => {
      if (opt.missing.length === 0) {
        setSuccessMsg("All ingredients available — start cooking!");
        setPhase("success");
        return;
      }

      setSteps([
        { id: "addr", label: "Getting delivery address", status: "loading" },
        ...opt.missing.map((item) => ({
          id: `item-${item}`,
          label: `Finding ${item}`,
          status: "pending" as StepStatus,
        })),
        { id: "cart", label: "Building cart", status: "pending" },
      ]);

      try {
        const address = await mcp.getDeliveryAddress();
        if (!address) throw new Error("No saved delivery address found");
        const addressId = (address.id || address.addressId) as string;
        setStep("addr", "done");

        const cartItems: { spinId: string; quantity: number }[] = [];

        for (const item of opt.missing) {
          setStep(`item-${item}`, "loading");
          try {
            const results = await mcp.searchProducts(item, addressId);
            // structuredContent returns { products: [...] }
            const productList = (
              Array.isArray(results)
                ? results
                : ((results as Record<string, unknown>)?.products as unknown[]) ?? []
            ) as Array<{
              inStock?: boolean;
              isAvail?: boolean;
              variations?: Array<{ spinId: string; isInStockAndAvailable?: boolean }>;
            }>;

            let spinId: string | null = null;
            for (const p of productList) {
              const variation =
                p.variations?.find((v) => v.isInStockAndAvailable !== false) ??
                p.variations?.[0];
              if (variation?.spinId) { spinId = variation.spinId; break; }
            }

            if (spinId) {
              setStep(`item-${item}`, "done");
              cartItems.push({ spinId, quantity: 1 });
            } else {
              setStep(`item-${item}`, "error");
            }
          } catch {
            setStep(`item-${item}`, "error");
          }
        }

        setStep("cart", "loading");
        await mcp.updateInstamartCart(cartItems, addressId);
        const cartData = await mcp.getInstamartCart(addressId) as Record<string, unknown>;
        setStep("cart", "done");

        const addrDetails = cartData?.selectedAddressDetails as Record<string, unknown> | undefined;
        const rawItems = (cartData?.items as Array<Record<string, unknown>>) ?? [];
        setCart({
          addressId,
          address: addrDetails
            ? `${addrDetails.flatNo ?? ""}, ${addrDetails.area ?? ""}, ${addrDetails.city ?? ""}`.replace(/^,\s*/, "")
            : undefined,
          itemCount: rawItems.length || cartItems.length,
          total: cartData?.cartTotalAmount as string | undefined,
          items: rawItems.map((i) => ({
            name: (i.itemName ?? "Item") as string,
            qty: (i.quantity ?? 1) as number,
            mrp: i.mrp as number | undefined,
          })),
        });
        setPhase("review-cart");
      } catch (err) {
        setErrorMsg((err as Error).message || "Something went wrong");
        setPhase("error");
      }
    },
    [setStep]
  );

  const runFoodFlow = useCallback(
    async (opt: OrderOption) => {
      setSteps([
        { id: "addr", label: "Getting delivery address", status: "loading" },
        { id: "search", label: `Finding "${opt.searchQuery}"`, status: "pending" },
        { id: "select", label: "Pick a restaurant", status: "pending" },
      ]);

      try {
        const address = await mcp.getDeliveryAddress();
        if (!address) throw new Error("No saved delivery address found");
        const addressId = (address.id || address.addressId) as string;
        setStep("addr", "done");

        setStep("search", "loading");
        const results = await mcp.searchRestaurants(opt.searchQuery, addressId, opt.maxBudget);
        const list = (
          Array.isArray(results)
            ? results
            : ((results as Record<string, unknown>)?.restaurants as unknown[]) || []
        ) as Record<string, unknown>[];
        setStep("search", "done");

        setRestaurants(list.slice(0, 3));
        setStep("select", "loading");
        setPhase("select-restaurant");
      } catch (err) {
        setErrorMsg((err as Error).message || "Something went wrong");
        setPhase("error");
      }
    },
    [setStep]
  );

  const runDineoutFlow = useCallback(
    async (opt: DineoutOption) => {
      setSteps([
        { id: "search", label: `Finding "${opt.searchQuery}"`, status: "loading" },
        { id: "select", label: "Pick a restaurant", status: "pending" },
      ]);

      try {
        const saved = mcp.getSavedAddress();
        if (!saved) throw new Error("No delivery address saved — please reconnect Swiggy.");
        const results = await mcp.searchDineoutRestaurants(opt.searchQuery, saved.id);
        const list = (
          Array.isArray(results)
            ? results
            : ((results as Record<string, unknown>)?.restaurants as unknown[]) || []
        ) as Record<string, unknown>[];
        setStep("search", "done");

        setRestaurants(list.slice(0, 3));
        setStep("select", "loading");
        setPhase("select-restaurant");
      } catch (err) {
        setErrorMsg((err as Error).message || "Something went wrong");
        setPhase("error");
      }
    },
    [setStep]
  );

  const runFlow = useCallback(() => {
    setPhase("running");
    if (option.type === "cook") runInstamartFlow(option as CookOption);
    else if (option.type === "order") runFoodFlow(option as OrderOption);
    else runDineoutFlow(option as DineoutOption);
  }, [option, runInstamartFlow, runFoodFlow, runDineoutFlow]);

  useEffect(() => {
    if (!isAuthenticated()) { setPhase("auth-needed"); return; }
    if (mcp.getSavedAddress()) { runFlow(); return; }
    // No address cached — load list so user can pick
    setPhase("pick-address");
    mcp.getDeliveryAddresses()
      .then(setAddressList)
      .catch(() => { setErrorMsg("Could not load your saved addresses"); setPhase("error"); });
  }, [runFlow]);

  const handleAddressPick = useCallback((addr: mcp.SwiggyAddress) => {
    mcp.saveAddress(addr);
    runFlow();
  }, [runFlow]);

  const handleRestaurantSelect = async (restaurant: Record<string, unknown>) => {
    setStep("select", "done");

    if (option.type === "order") {
      window.open("https://www.swiggy.com", "_blank");
      onClose();
      return;
    }

    if (option.type === "dineout") {
      appendStep({ id: "slots", label: "Checking available slots", status: "loading" });
      setPhase("running");
      try {
        const restaurantId = (restaurant.id || restaurant.restaurantId) as string;
        const savedAddr = mcp.getSavedAddress();
        let lat = savedAddr?.lat;
        let lng = savedAddr?.lng;
        if (!lat || !lng) {
          try {
            const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
            );
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
          } catch { /* proceed without coords */ }
        }
        const slotsText = await mcp.getDineoutSlots(restaurantId, 2, lat, lng);
        const parsed = parseDineoutSlots(slotsText);
        setStep("slots", "done");
        setSlots(parsed);
        setPhase("select-slot");
      } catch (err) {
        setErrorMsg((err as Error).message || "Could not fetch slots");
        setPhase("error");
      }
    }
  };

  const handleSlotSelect = (_slot: Record<string, unknown>) => {
    window.open("https://www.swiggy.com/dineout", "_blank");
    onClose();
  };

  const handleCheckout = async () => {
    if (!cart) return;
    appendStep({ id: "checkout", label: "Placing order", status: "loading" });
    try {
      await mcp.checkoutInstamart(cart.addressId);
      setStep("checkout", "done");
      setSuccessMsg(
        `${cart.itemCount} item${cart.itemCount > 1 ? "s" : ""} ordered on Instamart!`
      );
      setPhase("success");
    } catch (err) {
      setErrorMsg((err as Error).message || "Checkout failed");
      setPhase("error");
    }
  };

  const title =
    option.type === "cook"
      ? "Order via Instamart"
      : option.type === "order"
      ? "Order on Swiggy"
      : "Book a Table";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-white rounded-t-3xl max-w-md mx-auto w-full max-h-[82vh] flex flex-col slide-up">
        {/* Handle + header */}
        <div className="px-5 pt-4 pb-4 border-b border-swiggy-border flex-shrink-0">
          <div className="w-10 h-1 bg-swiggy-border rounded-full mx-auto mb-4" />
          <div className="flex items-center justify-between">
            <h2 className="text-base font-extrabold text-swiggy-dark">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="text-swiggy-gray text-lg leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-swiggy-light-gray"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-5 py-4 pb-8">
          {/* Auth check spinner */}
          {phase === "auth-check" && (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          )}

          {/* Address picker */}
          {phase === "pick-address" && (
            <div>
              <p className="text-xs font-bold text-swiggy-gray uppercase tracking-widest mb-1">
                Deliver to
              </p>
              <p className="text-sm text-swiggy-gray mb-4">
                Pick a delivery address for this order
              </p>
              {addressList.length === 0 ? (
                <div className="flex justify-center py-10"><Spinner /></div>
              ) : (
                <div className="space-y-2">
                  {addressList.map((addr) => (
                    <button
                      key={addr.id}
                      onClick={() => handleAddressPick(addr)}
                      className="w-full text-left bg-swiggy-light-gray rounded-2xl p-4 border border-swiggy-border active:bg-swiggy-border transition-colors flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="text-sm font-bold text-swiggy-dark">{addr.label}</p>
                        <p className="text-xs text-swiggy-gray mt-0.5 truncate">{addr.addressText}</p>
                      </div>
                      <span className="text-swiggy-orange font-bold text-lg flex-shrink-0">→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Auth needed */}
          {phase === "auth-needed" && (
            <div className="text-center py-10">
              <div className="text-5xl mb-4">🔐</div>
              <p className="text-base font-bold text-swiggy-dark mb-2">
                Connect your Swiggy account
              </p>
              <p className="text-sm text-swiggy-gray mb-8">
                One-time login with your phone number & OTP
              </p>
              <button
                onClick={startOAuthFlow}
                className="w-full bg-swiggy-orange text-white py-4 rounded-2xl font-extrabold text-base"
              >
                Connect Swiggy →
              </button>
            </div>
          )}

          {/* Step list */}
          {(phase === "running" ||
            phase === "review-cart" ||
            phase === "select-restaurant" ||
            phase === "select-slot") && (
            <div className="space-y-3 mb-4">
              {steps.map((step) => (
                <div key={step.id} className="flex items-center gap-3">
                  <StepIcon status={step.status} />
                  <span
                    className={`text-sm ${
                      step.status === "pending"
                        ? "text-swiggy-gray"
                        : "text-swiggy-dark font-medium"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Review cart */}
          {phase === "review-cart" && cart && (
            <div className="mt-2">
              {cart.address && (
                <div className="flex items-start gap-2 mb-3 px-3 py-2 bg-swiggy-green-light rounded-xl">
                  <span className="text-sm mt-0.5">📍</span>
                  <p className="text-xs text-swiggy-dark leading-relaxed">{cart.address}</p>
                </div>
              )}

              {cart.items && cart.items.length > 0 ? (
                <div className="rounded-2xl overflow-hidden border border-swiggy-border mb-4">
                  <div className="flex px-3 py-2 bg-swiggy-light-gray text-xs font-bold text-swiggy-gray uppercase tracking-wide">
                    <span className="flex-1">Item</span>
                    <span className="w-8 text-center">Qty</span>
                    <span className="w-14 text-right">Price</span>
                  </div>
                  {cart.items.map((item, i) => (
                    <div key={i} className="flex items-center px-3 py-2.5 border-t border-swiggy-border/60 bg-white">
                      <span className="flex-1 text-xs text-swiggy-dark leading-snug pr-2">{item.name}</span>
                      <span className="w-8 text-center text-xs text-swiggy-gray">{item.qty}</span>
                      <span className="w-14 text-right text-xs font-semibold text-swiggy-dark">
                        {item.mrp ? `₹${item.mrp}` : "—"}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center px-3 py-3 border-t border-swiggy-border bg-swiggy-light-gray">
                    <span className="text-sm font-bold text-swiggy-dark">Total</span>
                    <span className="text-base font-extrabold text-swiggy-orange">{cart.total ?? `${cart.itemCount} items`}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-swiggy-light-gray rounded-2xl p-4 mb-4 border border-swiggy-border">
                  <p className="text-sm font-bold text-swiggy-dark">{cart.itemCount} item{cart.itemCount > 1 ? "s" : ""} in cart</p>
                  {cart.total && <p className="text-base font-extrabold text-swiggy-orange mt-1">{cart.total}</p>}
                </div>
              )}

              <button
                onClick={handleCheckout}
                className="w-full bg-swiggy-orange text-white py-4 rounded-2xl font-extrabold text-base mb-3"
              >
                Place Instamart Order →
              </button>
              <button
                onClick={() => { window.open("https://www.swiggy.com/instamart", "_blank"); onClose(); }}
                className="w-full bg-swiggy-light-gray text-swiggy-dark py-4 rounded-2xl font-bold border border-swiggy-border"
              >
                Open Instamart →
              </button>
            </div>
          )}

          {/* Select restaurant */}
          {phase === "select-restaurant" && (
            <div className="mt-2">
              <p className="text-xs font-bold text-swiggy-gray uppercase tracking-widest mb-3">
                Pick a restaurant
              </p>
              {restaurants.length === 0 ? (
                <p className="text-sm text-swiggy-gray text-center py-8">
                  No restaurants found nearby
                </p>
              ) : (
                <div className="space-y-2">
                  {restaurants.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleRestaurantSelect(r)}
                      className="w-full text-left bg-swiggy-light-gray rounded-2xl p-4 flex items-center justify-between border border-swiggy-border active:bg-swiggy-border transition-colors"
                    >
                      <div>
                        <p className="text-sm font-bold text-swiggy-dark">
                          {(r.name || r.restaurantName || "Restaurant") as string}
                        </p>
                        <p className="text-xs text-swiggy-gray mt-0.5">
                          {Array.isArray(r.cuisine)
                            ? (r.cuisine as string[]).join(", ")
                            : (r.cuisine || r.cuisineType || "") as string}
                          {r.rating
                            ? ` · ★ ${typeof r.rating === "object"
                                ? (r.rating as Record<string, unknown>).value
                                : r.rating}`
                            : ""}
                          {r.costForTwo ? ` · ${r.costForTwo}` : r.deliveryTime ? ` · ${r.deliveryTime} min` : ""}
                        </p>
                      </div>
                      <span className="text-swiggy-orange font-bold text-lg">
                        →
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Select time slot */}
          {phase === "select-slot" && (
            <div className="mt-2">
              <p className="text-xs font-bold text-swiggy-gray uppercase tracking-widest mb-3">
                Pick a slot - opens Swiggy to confirm
              </p>
              <div className="grid grid-cols-2 gap-2">
                {slots.map((slot, i) => (
                  <button
                    key={i}
                    onClick={() => handleSlotSelect(slot)}
                    className="text-left p-3 bg-swiggy-light-gray rounded-2xl border border-swiggy-border active:bg-swiggy-border transition-colors"
                  >
                    <p className="text-xs font-extrabold text-swiggy-dark">
                      {slot.dayLabel as string} · {slot.meal as string}
                    </p>
                    <p className="text-xs text-swiggy-gray mt-0.5">{slot.timeRange as string}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Success */}
          {phase === "success" && (
            <div className="text-center py-10">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-base font-extrabold text-swiggy-dark mb-2">Done!</p>
              <p className="text-sm text-swiggy-gray mb-6">{successMsg}</p>
              <button
                onClick={onClose}
                className="w-full bg-swiggy-orange text-white py-4 rounded-2xl font-extrabold text-base"
              >
                Close
              </button>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="text-center py-10">
              <div className="text-5xl mb-4">⚠️</div>
              <p className="text-sm font-bold text-swiggy-dark mb-2">
                Something went wrong
              </p>
              <p className="text-xs text-swiggy-gray mb-6">{errorMsg}</p>
              {errorMsg.toLowerCase().includes("address") || errorMsg.toLowerCase().includes("serviceable") ? (
                <button
                  onClick={() => {
                    mcp.clearSavedAddress();
                    setAddressList([]);
                    setPhase("pick-address");
                    mcp.getDeliveryAddresses()
                      .then(setAddressList)
                      .catch(() => { setErrorMsg("Could not load addresses"); });
                  }}
                  className="w-full bg-swiggy-orange text-white py-4 rounded-2xl font-extrabold text-base mb-3"
                >
                  Change delivery address
                </button>
              ) : null}
              <button
                onClick={onClose}
                className="w-full bg-swiggy-light-gray text-swiggy-dark py-4 rounded-2xl font-bold border border-swiggy-border"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function parseDineoutSlots(text: string): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  for (const line of text.split("\n")) {
    const dateMatch = line.match(/(\d{4}-\d{2}-\d{2}):\s*(.+)/);
    if (!dateMatch) continue;
    const date = dateMatch[1];
    const dayLabel =
      date === today ? "Today" :
      date === tomorrow ? "Tomorrow" :
      new Date(date).toLocaleDateString("en-IN", { weekday: "short", month: "short", day: "numeric" });
    for (const seg of dateMatch[2].split(";")) {
      const m = seg.trim().match(/(\w+)\s*\(([^,)]+)/);
      if (!m) continue;
      result.push({ id: `${date}-${m[1].toLowerCase()}`, dayLabel, meal: m[1], timeRange: m[2].trim() });
    }
  }
  return result.slice(0, 6);
}

function Spinner() {
  return (
    <div className="w-6 h-6 border-2 border-swiggy-orange border-t-transparent rounded-full animate-spin" />
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "loading")
    return (
      <div className="flex-shrink-0">
        <Spinner />
      </div>
    );
  if (status === "done")
    return (
      <div className="w-5 h-5 bg-swiggy-green rounded-full flex items-center justify-center flex-shrink-0">
        <svg
          className="w-3 h-3 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
    );
  if (status === "error")
    return (
      <div className="w-5 h-5 bg-red-400 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">
        ✕
      </div>
    );
  return (
    <div className="w-5 h-5 border-2 border-swiggy-border rounded-full flex-shrink-0" />
  );
}
