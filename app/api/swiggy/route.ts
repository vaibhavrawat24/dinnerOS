import { NextRequest, NextResponse } from "next/server";

const SERVER_URLS: Record<string, string> = {
  food: "https://mcp.swiggy.com/food",
  im: "https://mcp.swiggy.com/im",
  dineout: "https://mcp.swiggy.com/dineout",
};

export async function POST(req: NextRequest) {
  try {
    const { server, tool, params, token } = await req.json();

    const url = SERVER_URLS[server as string];
    if (!url) {
      return NextResponse.json({ error: "Invalid server" }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json(
        { error: "Missing Swiggy auth token" },
        { status: 401 }
      );
    }

    const body = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: tool,
        arguments: params ?? {},
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `Swiggy MCP error: ${res.status}`, detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Swiggy MCP proxy error:", error);
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}
