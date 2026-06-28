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
  params: Record<string, unknown> = {}
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

  // Parse MCP JSON-RPC response envelope
  if (data?.result?.content?.[0]?.type === "text") {
    try {
      return JSON.parse(data.result.content[0].text);
    } catch {
      return data.result.content[0].text;
    }
  }
  if (data?.result) return data.result;
  if (data?.error) throw new Error(data.error.message || "MCP error");
  return data;
}

// Typed helpers used by SwiggyExecutor

export async function getDeliveryAddress(): Promise<Record<string, unknown> | null> {
  const result = await callMCP("food", "get_addresses", {});

  // Structured: array of address objects
  if (Array.isArray(result) && result.length > 0) {
    return result[0] as Record<string, unknown>;
  }

  // Structured: { addresses: [...] }
  if (result && typeof result === "object") {
    const list = ((result as Record<string, unknown>).addresses as unknown[]) ?? [];
    if (list.length > 0) return list[0] as Record<string, unknown>;
  }

  // Text: "Found N saved addresses...\n1. [label] Name: address text (ID: xxx)"
  if (typeof result === "string") {
    // Extract first ID
    const idMatch = result.match(/\(ID:\s*([^)\s]+)\)/);
    if (!idMatch) return null;
    const id = idMatch[1].trim();

    // Try to extract label + address for display
    const lineMatch = result.match(/1\.\s*\[([^\]]+)\][^:]+:\s*([^(]+)/);
    return {
      id,
      addressId: id,
      label: lineMatch?.[1]?.trim() ?? "Saved address",
      address: lineMatch?.[2]?.trim() ?? "",
    };
  }

  return null;
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
  items: Array<{ productId: string; variantId: string; quantity: number }>,
  addressId: string
): Promise<unknown> {
  return callMCP("im", "update_cart", { items, addressId });
}

export async function getInstamartCart(addressId: string): Promise<unknown> {
  return callMCP("im", "get_cart", { addressId });
}

export async function checkoutInstamart(addressId: string): Promise<unknown> {
  return callMCP("im", "checkout", { addressId });
}

export async function searchDineoutRestaurants(
  query: string,
  locationId: string
): Promise<unknown> {
  return callMCP("dineout", "search_restaurants_dineout", {
    query,
    locationId,
  });
}

export async function getDineoutSlots(
  restaurantId: string,
  partySize = 2
): Promise<unknown> {
  return callMCP("dineout", "get_available_slots", { restaurantId, partySize });
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
