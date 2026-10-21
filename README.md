# Storefront Starter

A small shop on your own domain that sells btab products through the [Storefront API](https://btab.app/developers/storefront-api). Product list, product pages, a cart that btab prices, freight by postcode, a quote request for made-to-order goods, and a hand-off to the store's checkout.

**Step by step:** [the Storefront tutorial](https://btab.app/developers/storefront-tutorial).

## Run it
You need Node.js 20 and a test key from your btab dashboard: **Settings → Developers → Publishable keys → Make a key**, tick **Test key**, and add `http://localhost:3000` to its allowed sites.

```bash
npm install
cp .env.example .env.local   # paste your key into NEXT_PUBLIC_BTAB_PUBLISHABLE_KEY
npm run dev                  # http://localhost:3000
```

A test key shows btab's demo store: five made-up products, including a sold-out lamp, a table sold by quote, and a cushion in three colours. Its checkout ends in **Place test order**. Nothing is charged or sent.

Other ways to run it:
- Docker: `docker compose --env-file .env.local up --build`
- GitHub Codespaces: open the repo in a codespace, and add the codespace's address to the key's allowed sites.

## Settings (`.env.local`)
| Setting | What |
|---|---|
| `NEXT_PUBLIC_BTAB_API_BASE` | `https://api.btab.app/api/storefront/v1`. Keep it. |
| `NEXT_PUBLIC_BTAB_PUBLISHABLE_KEY` | Your publishable key (`btab_pk_test_…` or `btab_pk_live_…`). Never a store API key (`btab_live_…`). |
| `NEXT_PUBLIC_SITE_URL` | This shop's address. It must be on the key's allowed sites; checkout returns to `<it>/thanks`. |
| `NEXT_PUBLIC_SHOP_NAME`, `NEXT_PUBLIC_SHOP_DESCRIPTION` | Your shop's name and description. |

## What is where
| Path | What |
|---|---|
| `lib/btab.ts` | A typed client: one function per API call, errors as `BtabError` with the API's `code` |
| `app/page.tsx`, `app/products/[id]/page.tsx` | Product list and product page, read on the server (cached 60 s) |
| `components/AddToCart.tsx` | Options, Add to cart, Sold out, Enquire |
| `app/cart/page.tsx` | Cart, freight by postcode, quote request, Check out |
| `app/thanks/page.tsx` | The return page: reads the checkout session |
| `app/photo/[token]/route.ts` | Serves product photos from this shop's own address |
| `lib/*.test.ts` | Tests against a fake API (no live calls) |

## Checks
```bash
npm run lint && npm run typecheck && npm test
```
GitHub Actions runs the same, plus a build.

## Known issues
See [the tutorial's Known issues](https://btab.app/developers/storefront-tutorial#known-issues).
