# Connect Supabase and WAHA

The live site still uses browser storage and opens WhatsApp for manual sending. These steps prepare the services; do not treat them as connected until the site code is switched to Supabase and tested.

1. Create a Supabase project. In **Authentication → Users**, add your shop-owner account and set its password. Disable public sign-ups if only the shop owner should use the site.
2. In **SQL Editor**, run [`schema.sql`](schema.sql). It creates one state row per signed-in user and RLS rules that allow only that user to read or change the row. Do not turn RLS off.
3. In **Project Settings → API Keys**, copy the **Project URL** and **publishable key** (`sb_publishable_...`). These are the only Supabase values that may go into browser code. Never paste a secret key or service-role key into GitHub Pages.
4. Run WAHA on an always-on server reachable through **HTTPS**. Create a strong WAHA API key, start the `default` session or note its actual name, scan the QR code, and confirm that the session is **WORKING**. Send a test message to your own number from WAHA before connecting the site.
5. In Supabase **Edge Functions → Deploy a new function → Via Editor**, name it `send-bill`, paste [`functions/send-bill/index.ts`](functions/send-bill/index.ts), and deploy it. Keep JWT verification enabled. The function accepts a saved bill ID from a signed-in user and fetches that user's bill under RLS before calling WAHA.
6. In Supabase **Edge Functions → Secrets**, enter `WAHA_URL` (the HTTPS base URL without `/api/sendText`), `WAHA_SESSION` (for example `default`), and `WAHA_API_KEY`. Enter the key in Supabase only. Do not put it in this repository or the browser.
7. In GitHub, open [`dist/config.js`](../dist/config.js), click the pencil icon, and enter the Supabase Project URL and **publishable key** between the quotes. Commit the change to `main`. GitHub Pages will redeploy automatically. Do not enter the secret or service-role key there.
8. Open the live site and sign in with the owner email and password. Existing bills in that browser are copied to Supabase; bills from other browsers are copied when you sign in there. The browser copies are retained as a backup.
9. Test saving a bill, refreshing, opening it on another device, signing out, and sending a bill to your own WhatsApp number. Confirm that an unsigned visitor cannot read shop data. The site's WhatsApp button switches to automatic sending only after Supabase is configured and signed in.

Supabase's [API key guide](https://supabase.com/docs/guides/getting-started/api-keys), [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security), and [Edge Function dashboard guide](https://supabase.com/docs/guides/functions/quickstart-dashboard) explain the dashboard controls. WAHA's [quick start](https://waha.devlike.pro/docs/overview/quick-start/) shows its session and `/api/sendText` endpoint.
