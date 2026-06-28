# DinnerOS - AI Dinner Decision Engine

> Stop asking *"what should I eat tonight?"* - let AI decide, then order it in one tap.

DinnerOS is an AI-powered dinner decision app built on top of **Swiggy's MCP (Model Context Protocol)**. It takes your pantry inventory, mood, time, and budget, uses Claude AI to generate a ranked dinner recommendation, and then executes it via Swiggy - food delivery, Instamart grocery delivery, or Dineout table booking - without the user ever opening the Swiggy app.

---

## Demo link:

https://drive.google.com/file/d/1BP_jZxPieeX9RTJEoPSCFkt3xveIC7BZ/view?usp=sharing

---

## What it does

1. **AI Decision Engine** — Claude (via OpenRouter) analyzes your pantry items, recent meals, available time, energy level, and budget to recommend 3 dinner options ranked by relevance. Options are categorised as cook at home, food delivery, grocery delivery (Instamart), or dineout.

2. **One-tap Swiggy execution** — Once the user picks an option, DinnerOS connects to Swiggy via MCP and handles the full flow:
   - **Food delivery** → searches restaurants and opens Swiggy to complete the order
   - **Instamart** → searches for ingredients, builds a cart, shows a cart review, and places the order directly via MCP
   - **Dineout** → searches restaurants, fetches available slots, and books a table via MCP

3. **Persistent address bar** — A header-level address picker lets users choose their Swiggy delivery address once; all three flows use it automatically.

---

## Swiggy MCP Integration

DinnerOS integrates with all three Swiggy MCP servers over the **MCP Streamable HTTP** protocol (JSON-RPC 2.0). Authentication uses **PKCE OAuth 2.0 with Dynamic Client Registration** - no hardcoded credentials, the app self-registers at runtime.

### MCP Servers used

| Server | Base URL |
|---|---|
| Food | `https://mcp.swiggy.com/food` |
| Instamart | `https://mcp.swiggy.com/im` |
| Dineout | `https://mcp.swiggy.com/dineout` |

### MCP Tools used

#### Food server (`/food`)
| Tool | Purpose |
|---|---|
| `get_addresses` | Fetch user's saved Swiggy delivery addresses |
| `search_restaurants` | Search food delivery restaurants by dish/cuisine + address + budget |

#### Instamart server (`/im`)
| Tool | Purpose |
|---|---|
| `search_products` | Search grocery products by ingredient name |
| `update_cart` | Add items to Instamart cart (uses `spinId` + `selectedAddressId`) |
| `get_cart` | Fetch current cart with items, quantities, and total |
| `checkout` | Place the Instamart order |

#### Dineout server (`/dineout`)
| Tool | Purpose |
|---|---|
| `search_restaurants_dineout` | Search dine-in restaurants near an address |
| `get_available_slots` | Get available booking time slots for a restaurant |
| `create_cart` | Create a dineout booking cart |
| `book_table` | Confirm the table booking |

### Auth flow
- Dynamic Client Registration (`POST /auth/register`)
- PKCE Authorization Code flow (`/auth/authorize` → `/auth/callback`)
- Token exchange (`POST /auth/token`)
- Token stored in browser `sessionStorage`; all MCP calls go through a Next.js serverless proxy that attaches the `Authorization: Bearer` header

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| AI | Claude Sonnet via OpenRouter |
| MCP Protocol | Swiggy MCP (Streamable HTTP / JSON-RPC 2.0) |
| Hosting | Vercel (serverless) |
| Auth | PKCE OAuth 2.0 + Dynamic Client Registration |

---

## Project structure

```
app/
  api/
    swiggy/
      route.ts          # MCP proxy (initialise → notify → call)
      register/         # Dynamic Client Registration
      token/            # OAuth token exchange
    claude/             # AI decision generation
  auth/callback/        # OAuth redirect handler
  pantry/               # Pantry management UI
lib/
  swiggy-mcp.ts         # MCP client + typed helpers for all tools
  swiggy-auth.ts        # PKCE OAuth flow
  decision-engine.ts    # Claude prompt builder
  pantry.ts             # localStorage pantry state
components/
  SwiggyExecutor.tsx    # Full execution drawer (all 3 Swiggy flows)
  AddressBar.tsx        # Persistent address picker in header
  OptionCard.tsx        # Dinner option card UI
```

---

## Note on Swiggy MCP access

DinnerOS currently works in local development. For public hosting (Vercel), the app's redirect URI domain needs to be whitelisted by Swiggy as an approved MCP integration. We'd love to be added to the whitelist - this project is a demonstration of what a real consumer product built on Swiggy MCP can look like.

**Contact:** rawatvaibhav42@gmail.com
