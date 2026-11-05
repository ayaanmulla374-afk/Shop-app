# Maharashtra Dry Cleaners Billing

A simple private billing site for pressing and dry cleaning. The current site lets you set prices, add items, enter quantities, calculate totals, save bills in the current browser, print bills, and open a prepared WhatsApp message for manual sending.

**GitHub live site:** https://ayaanmulla374-afk.github.io/Shop-app/

**Supabase and WAHA setup:** See [supabase/SETUP.md](supabase/SETUP.md). The live site uses browser storage and manual WhatsApp until `dist/config.js` is filled with a Supabase Project URL and publishable key.

## Run locally

The site is plain HTML, CSS, and JavaScript. Serve `dist/` with any static web server and open its local URL. No package install or build is needed. For example:

```sh
python -m http.server 8000 --directory dist
```

Visit `http://localhost:8000`. Bills and prices currently live in that browser's `localStorage`; clearing browser data removes them. There is no Supabase or WAHA connection in this code yet.

## 1. Set up Supabase for customer and bill storage

1. [Create a Supabase project](https://supabase.com/dashboard) for the shop. Choose a strong database password and save it in a password manager.
2. In the project dashboard, open **Connect** to copy the **Project URL** and **publishable key**. You can also find keys in **Settings → API Keys**. The publishable key starts with `sb_publishable_`.
3. Decide who may use the billing site. For a single shop owner, enable Supabase Auth sign-in for that person. Create tables for **customers**, **prices/items**, and **bills**. A bill should keep its own item names, quantities, rates, total, billing period, customer details, and creation time so later price changes do not rewrite old bills.
4. Enable **Row Level Security (RLS)** on every exposed table. Write policies that let only the signed-in shop owner read and change these records. Test that an unsigned visitor cannot read or write them. The publishable key alone does not secure customer data.
5. Replace this site's `localStorage` reads and writes in `dist/app.js` with authenticated Supabase calls. Before switching, export or migrate any bills already saved in the browser; they are not automatically in Supabase.
6. Store the Project URL and publishable key in the app configuration. Keep any Supabase **secret key** on a server only; never put it in `dist/` or commit it to GitHub.
7. Test: sign in, set a price, save a bill, refresh and reopen it, then sign out and confirm the data is unavailable.

Supabase references: [API keys](https://supabase.com/docs/guides/getting-started/api-keys), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 2. Set up WAHA for automatic WhatsApp sending

1. Follow the [WAHA Quick Start](https://waha.devlike.pro/docs/overview/quick-start/) to run WAHA on a server that stays online. A local `localhost` URL will work only on that same computer; the deployed site needs a server reachable over HTTPS.
2. Set a WAHA API key as described in its [security guide](https://waha.devlike.pro/docs/how-to/security/). Keep the key in protected server settings, never in browser JavaScript or GitHub.
3. In the WAHA dashboard, start a session (for example, `default`). Scan its QR code with the shop's WhatsApp account and wait for the session to show **WORKING**.
4. Record the WAHA **HTTPS base URL**, **session name**, and **API key**. The sending endpoint is `POST /api/sendText`; its API key is sent in the `X-Api-Key` header. Test a message to your own number first.
5. Add a protected server endpoint or Supabase Edge Function for sending. The browser calls that endpoint with a saved bill ID; the server verifies the signed-in shop owner, loads the bill, formats the message, and calls WAHA. Keep the WAHA key and URL in server environment secrets. Do not call WAHA directly from `dist/app.js`.
6. Only show **Sent** after WAHA confirms success. Record the send result on the bill, and show a useful error if the session is disconnected or the API fails.

WAHA references: [Quick Start](https://waha.devlike.pro/docs/overview/quick-start/), [sending messages](https://waha.devlike.pro/docs/how-to/send-messages/), [API security](https://waha.devlike.pro/docs/how-to/security/).

## Details needed to finish the integrations

| Supabase | WAHA |
| --- | --- |
| Project URL | HTTPS base URL |
| Publishable key | Session name |
| Shop owner sign-in choice | API key, entered only in protected server settings |

The current **Open in WhatsApp** button prepares a message for review and manual sending. It does not use WAHA yet.
