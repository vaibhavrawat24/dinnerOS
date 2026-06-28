import { NextRequest, NextResponse } from "next/server";

const SERVER_URLS: Record<string, string> = {
  food: "https://mcp.swiggy.com/food",
  im: "https://mcp.swiggy.com/im",
  dineout: "https://mcp.swiggy.com/dineout",
};

const MCP_HEADERS = (token: string) => ({
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
  Authorization: `Bearer ${token}`,
});

async function fetchMCP(url: string, token: string, body: unknown, sessionId?: string) {
  const headers: Record<string, string> = MCP_HEADERS(token);
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return res;
}

async function parseMCPResponse(res: Response): Promise<{ ok: boolean; status: number; data: unknown; text: string }> {
  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  if (!res.ok) {
    console.error(`Swiggy MCP ${res.status}:`, text.slice(0, 500));
    return { ok: false, status: res.status, data: null, text };
  }

  if (contentType.includes("text/event-stream")) {
    let lastData: unknown = null;
    for (const line of text.split("\n")) {
      if (line.startsWith("data:")) {
        try { lastData = JSON.parse(line.slice(5).trim()); } catch { /* skip */ }
      }
    }
    console.log("[MCP SSE raw]", JSON.stringify(lastData).slice(0, 500));
    return { ok: true, status: 200, data: lastData, text };
  }

  try {
    const data = JSON.parse(text);
    console.log("[MCP JSON raw]", JSON.stringify(data).slice(0, 500));
    return { ok: true, status: 200, data, text };
  } catch {
    return { ok: true, status: 200, data: text, text };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { server, tool, params, token, listTools } = await req.json();

    const url = SERVER_URLS[server as string];
    if (!url) return NextResponse.json({ error: "Invalid server" }, { status: 400 });
    if (!token) return NextResponse.json({ error: "Missing Swiggy auth token" }, { status: 401 });

    // Step 1: Initialize MCP session
    const initRes = await fetchMCP(url, token, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        clientInfo: { name: "DinnerOS", version: "1.0.0" },
        capabilities: {},
      },
    });
    const sessionId = initRes.headers.get("Mcp-Session-Id") ?? undefined;
    await initRes.text(); // drain body

    // Step 2: Notify initialized (fire-and-forget)
    if (sessionId) {
      fetchMCP(url, token, { jsonrpc: "2.0", method: "notifications/initialized" }, sessionId).catch(() => {});
    }

    // Step 3: List tools (debug mode) or call tool
    const mcpBody = listTools
      ? { jsonrpc: "2.0", id: Date.now(), method: "tools/list", params: {} }
      : {
          jsonrpc: "2.0",
          id: Date.now(),
          method: "tools/call",
          params: { name: tool, arguments: params ?? {} },
        };

    const res = await fetchMCP(url, token, mcpBody, sessionId);
    const { ok, status, data, text } = await parseMCPResponse(res);

    if (!ok) {
      return NextResponse.json({ error: `Swiggy MCP error: ${status}`, detail: text }, { status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Swiggy MCP proxy error:", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}
