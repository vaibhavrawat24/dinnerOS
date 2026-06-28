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
  const [cart, setCart] = useState<{ addressId: string; itemCount: number; billTotal?: string } | null>(null);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Record<string, unknown> | null>(null);
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

        const cartItems: { productId: string; variantId: string; quantity: number }[] = [];

        for (const item of opt.missing) {
          setStep(`item-${item}`, "loading");
          try {
            const results = await mcp.searchProducts(item, addressId);
            const list = Array.isArray(results)
              ? results
              : ((results as Record<string, unknown>)?.products as unknown[]) || [];
            const product = list[0] as Record<string, unknown> | undefined;
            if (product) {
              setStep(`item-${item}`, "done");
              cartItems.push({
                productId: (product.id || product.productId) as string,
                variantId: (
                  product.variantId ||
                  (product.variants as Record<string, unknown>[])?.[0]?.id
                ) as string,
                quantity: 1,
              });
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

        setCart({
          addressId,
          itemCount: cartItems.length,
          billTotal: cartData?.billTotal as string | undefined,
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
        { id: "loc", label: "Getting your location", status: "loading" },
        { id: "search", label: `Finding "${opt.searchQuery}"`, status: "pending" },
        { id: "select", label: "Pick a restaurant", status: "pending" },
      ]);

      try {
        const locs = await mcp.callMCP("dineout", "get_saved_locations", {});
        const locList = Array.isArray(locs)
          ? locs
          : ((locs as Record<string, unknown>)?.locations as unknown[]) || [];
        const loc = locList[0] as Record<string, unknown> | undefined;
        const locationId = (loc?.id || loc?.locationId || "") as string;
        setStep("loc", "done");

        setStep("search", "loading");
        const results = await mcp.searchDineoutRestaurants(opt.searchQuery, locationId);
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
    if (isAuthenticated()) {
      runFlow();
    } else {
      setPhase("auth-needed");
    }
  }, [runFlow]);

  const handleRestaurantSelect = async (restaurant: Record<string, unknown>) => {
    setSelectedRestaurant(restaurant);
    setStep("select", "done");

    if (option.type === "dineout") {
      appendStep({ id: "slots", label: "Checking available slots", status: "loading" });
      setPhase("running");
      try {
        const restaurantId = (restaurant.id || restaurant.restaurantId) as string;
        const slotsData = await mcp.getDineoutSlots(restaurantId);
        const list = (
          Array.isArray(slotsData)
            ? slotsData
            : ((slotsData as Record<string, unknown>)?.slots as unknown[]) || []
        ) as Record<string, unknown>[];
        setStep("slots", "done");
        setSlots(list.slice(0, 6));
        setPhase("select-slot");
      } catch (err) {
        setErrorMsg((err as Error).message || "Could not fetch slots");
        setPhase("error");
      }
    }
  };

  const handleSlotSelect = async (slot: Record<string, unknown>) => {
    if (!selectedRestaurant) return;
    appendStep({ id: "book", label: "Booking your table", status: "loading" });
    setPhase("running");
    try {
      await mcp.bookDineoutTable(
        (selectedRestaurant.id || selectedRestaurant.restaurantId) as string,
        (slot.id || slot.slotId) as string,
        2
      );
      setStep("book", "done");
      const rName = (selectedRestaurant.name || selectedRestaurant.restaurantName || "restaurant") as string;
      const slotLabel = (slot.time || slot.label || slot.startTime || "your slot") as string;
      setSuccessMsg(`Table booked at ${rName} for ${slotLabel}!`);
      setPhase("success");
    } catch (err) {
      setErrorMsg((err as Error).message || "Booking failed");
      setPhase("error");
    }
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
              <div className="bg-swiggy-light-gray rounded-2xl p-4 mb-4 border border-swiggy-border">
                <p className="text-sm font-bold text-swiggy-dark">
                  {cart.itemCount} item{cart.itemCount > 1 ? "s" : ""} ready
                </p>
                {cart.billTotal && (
                  <p className="text-xs text-swiggy-gray mt-1">
                    Total: ₹{cart.billTotal}
                  </p>
                )}
              </div>
              <button
                onClick={handleCheckout}
                className="w-full bg-swiggy-orange text-white py-4 rounded-2xl font-extrabold text-base"
              >
                Place Instamart Order →
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
                          {(r.cuisine || r.cuisineType || "") as string}
                          {r.rating ? ` · ★ ${r.rating}` : ""}
                          {r.deliveryTime ? ` · ${r.deliveryTime} min` : ""}
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
                Pick a time slot
              </p>
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot, i) => (
                  <button
                    key={i}
                    onClick={() => handleSlotSelect(slot)}
                    className="py-3 bg-swiggy-light-gray rounded-2xl text-sm font-bold text-swiggy-dark border border-swiggy-border active:bg-swiggy-border transition-colors"
                  >
                    {(slot.time || slot.label || slot.startTime || `Slot ${i + 1}`) as string}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Success */}
          {phase === "success" && (
            <div className="text-center py-10">
              <div className="text-5xl mb-4">✅</div>
              <p className="text-base font-extrabold text-swiggy-dark mb-2">
                Done!
              </p>
              <p className="text-sm text-swiggy-gray mb-8">{successMsg}</p>
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
              <p className="text-xs text-swiggy-gray mb-8">{errorMsg}</p>
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
