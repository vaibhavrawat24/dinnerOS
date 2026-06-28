import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { redirectUri } = await req.json();

    const res = await fetch("https://mcp.swiggy.com/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        redirect_uris: [redirectUri],
        client_name: "DinnerOS",
        token_endpoint_auth_method: "none",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "Registration failed", detail: text },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ client_id: data.client_id });
  } catch (error) {
    console.error("DCR error:", error);
    return NextResponse.json({ error: "Registration error" }, { status: 500 });
  }
}
