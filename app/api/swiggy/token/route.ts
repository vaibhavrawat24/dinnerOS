import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { code, code_verifier, client_id, redirect_uri } = await req.json();

    if (!code || !code_verifier || !redirect_uri) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }

    const params: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      code_verifier,
      redirect_uri,
    };
    if (client_id) params.client_id = client_id;

    const res = await fetch("https://mcp.swiggy.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: "Token exchange failed", detail: text },
        { status: 400 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Token exchange error:", error);
    return NextResponse.json({ error: "Token exchange error" }, { status: 500 });
  }
}
