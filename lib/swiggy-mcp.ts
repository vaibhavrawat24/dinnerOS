import { getToken } from "./swiggy-auth";

type MCPServer = "food" | "im" | "dineout";

export async function listMCPTools(server: MCPServer): Promise<unknown> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated with Swiggy");
  const res = await fetch("/api/swiggy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ server, listTools: true, token }),
  });
  return res.json();
}

export async function callMCP(
  server: MCPServer,
  tool: string,
  params: Record<string, unknown> = {},
  opts: { preferText?: boolean } = {}
): Promise<unknown> {
  const token = getToken();
  if (!token) throw new Error("Not authenticated with Swiggy");

  const res = await fetch("/api/swiggy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ server, tool, params, token }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error || `MCP call failed (${res.status})`
    );
  }

  const data = await res.json();

  // isError flag in result means the MCP tool returned an error
  if (data?.result?.isError) {
    const errText = (data.result.content?.[0]?.text as string) ?? "MCP error";
    throw new Error(errText.split("\n")[0].trim());
  }

  // Prefer structuredContent when non-empty (unless caller wants raw text)
  if (!opts.preferText) {
    const structured = data?.result?.structuredContent;
    if (structured && typeof structured === "object" && Object.keys(structured).length > 0) {
      return structured;
    }
  }

  // Text content
  if (data?.result?.content?.[0]?.type === "text") {
    const text = data.result.content[0].text as string;
    try { return JSON.parse(text); }
    catch { return text; }
  }

  if (data?.result) return data.result;
  if (data?.error) throw new Error((data.error as { message?: string }).message || "MCP error");
  return data;
}

const ADDR_ID_KEY = "dinnerOS_selectedAddressId";
const ADDR_LABEL_KEY = "dinnerOS_selectedAddressLabel";
const ADDR_LAT_KEY = "dinnerOS_selectedAddressLat";
const ADDR_LNG_KEY = "dinnerOS_selectedAddressLng";

export interface SwiggyAddress {
  id: string;
  label: string;
  addressText: string;
  lat?: number;
  lng?: number;
}

export function getSavedAddress(): SwiggyAddress | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem(ADDR_ID_KEY);
  const label = localStorage.getItem(ADDR_LABEL_KEY);
  if (!id || !label || label === "Address") {
    if (id) clearSavedAddress();
    return null;
  }
  const lat = parseFloat(localStorage.getItem(ADDR_LAT_KEY) ?? "");
  const lng = parseFloat(localStorage.getItem(ADDR_LNG_KEY) ?? "");
  return {
    id, label, addressText: "",
    ...(isFinite(lat) ? { lat } : {}),
    ...(isFinite(lng) ? { lng } : {}),
  };
}

export function saveAddress(addr: SwiggyAddress): void {
  localStorage.setItem(ADDR_ID_KEY, addr.id);
  localStorage.setItem(ADDR_LABEL_KEY, addr.label);
  if (addr.lat != null) localStorage.setItem(ADDR_LAT_KEY, String(addr.lat));
  if (addr.lng != null) localStorage.setItem(ADDR_LNG_KEY, String(addr.lng));
  window.dispatchEvent(new Event("dinnerOS:addressChanged"));
}

export function clearSavedAddress(): void {
  localStorage.removeItem(ADDR_ID_KEY);
  localStorage.removeItem(ADDR_LABEL_KEY);
  localStorage.removeItem(ADDR_LAT_KEY);
  localStorage.removeItem(ADDR_LNG_KEY);
}

function parseAddressText(text: string): SwiggyAddress[] {
  const addresses: SwiggyAddress[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\d+\.\s*\[([^\]]+)\][^:]*:\s*(.+?)\s*\(ID:\s*([^)\s]+)\)/);
    if (m) addresses.push({ label: m[1].trim(), addressText: m[2].trim(), id: m[3].trim() });
  }
  return addresses;
}

export async function getDeliveryAddresses(): Promise<SwiggyAddress[]> {
  const result = await callMCP("food", "get_addresses", {});

  // Structured content has addressTag (user nickname) and addressLine
  if (result && typeof result === "object") {
    const list = ((result as Record<string, unknown>).addresses as Record<string, unknown>[]) ?? [];
    if (list.length > 0) {
      return list
        .filter((a) => a.id)
        .map((a) => {
          const lat = Number(a.latitude ?? a.lat);
          const lng = Number(a.longitude ?? a.lng);
          return {
            id: a.id as string,
            label: ((a.addressTag ?? a.addressCategory ?? "Address") as string),
            addressText: (a.addressLine as string) ?? "",
            ...(isFinite(lat) ? { lat } : {}),
            ...(isFinite(lng) ? { lng } : {}),
          };
        });
    }
  }

  // Fallback: parse text
  if (typeof result === "string") return parseAddressText(result);
  return [];
}

// Typed helpers used by SwiggyExecutor

export async function getDeliveryAddress(): Promise<Record<string, unknown> | null> {
  // Use user's chosen address if cached
  const saved = getSavedAddress();
  if (saved) return { id: saved.id, addressId: saved.id, label: saved.label };

  // Fetch first address as fallback
  const addresses = await getDeliveryAddresses();
  if (addresses.length === 0) return null;
  return { id: addresses[0].id, addressId: addresses[0].id, label: addresses[0].label };
}

export async function searchRestaurants(
  query: string,
  addressId: string,
  maxBudget?: number
): Promise<unknown> {
  return callMCP("food", "search_restaurants", {
    query,
    addressId,
    ...(maxBudget ? { maxBudget } : {}),
  });
}

export async function searchProducts(
  query: string,
  addressId: string
): Promise<unknown> {
  return callMCP("im", "search_products", { query, addressId });
}

export async function updateInstamartCart(
  items: Array<{ spinId: string; quantity: number }>,
  addressId: string
): Promise<unknown> {
  return callMCP("im", "update_cart", { items, selectedAddressId: addressId });
}

export async function getInstamartCart(addressId: string): Promise<unknown> {
  return callMCP("im", "get_cart", { selectedAddressId: addressId });
}

export async function checkoutInstamart(addressId: string): Promise<unknown> {
  return callMCP("im", "checkout", { selectedAddressId: addressId });
}

export async function searchDineoutRestaurants(
  query: string,
  addressId: string
): Promise<unknown> {
  return callMCP("dineout", "search_restaurants_dineout", {
    query,
    addressId,
  });
}

export async function getDineoutSlots(
  restaurantId: string,
  partySize = 2,
  lat?: number,
  lng?: number
): Promise<string> {
  const date = new Date().toISOString().split("T")[0];
  const result = await callMCP(
    "dineout",
    "get_available_slots",
    {
      restaurantId,
      partySize,
      date,
      ...(lat != null ? { latitude: lat } : {}),
      ...(lng != null ? { longitude: lng } : {}),
    },
    { preferText: true }
  );
  return typeof result === "string" ? result : JSON.stringify(result);
}

export async function bookDineoutTable(
  restaurantId: string,
  slotId: string,
  partySize: number
): Promise<unknown> {
  const cart = await callMCP("dineout", "create_cart", {
    restaurantId,
    slotId,
    partySize,
  });
  return callMCP("dineout", "book_table", {
    restaurantId,
    slotId,
    partySize,
    cartId:
      (cart as Record<string, unknown>)?.cartId ||
      (cart as Record<string, unknown>)?.id,
  });
}
