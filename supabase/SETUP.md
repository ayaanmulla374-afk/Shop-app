# Supabase and automatic WhatsApp bills

The live site already has a Supabase Project URL and publishable key in `dist/config.js`. Owner sign-in and bill saving use the `shop_state` table defined in [schema.sql](schema.sql). Keep RLS enabled. The current WhatsApp action remains manual until the steps below are complete.

## Prepare Meta WhatsApp Business Platform

1. Set up direct Cloud API access for the shop's WhatsApp Business number in Meta Business Manager. Confirm that the number can use the Business app and Platform together if you need both. Obtain its **Phone Number ID** and an access token with permission to send WhatsApp messages. Keep the token private.
2. In WhatsApp Manager, create and get approval for the **Utility** template in language code `en`:
   - `bill_pdf_utility_v2`: **document header** and text body `Hi {{1}}, your invoice from Maharashtra Dry Cleaners is attached.`
   The name, language, document header, and body parameter must match the code. Meta may classify or reject a template; check its approved status before continuing. Collect the customer's agreement to receive bills on WhatsApp.
3. Add a payment method in Meta if required for business-initiated messages. Confirm the phone number can send an approved template to your own test number.

## Deploy the send function

4. In Supabase **Edge Functions**, deploy [functions/send-bill/index.ts](functions/send-bill/index.ts) as `send-bill`, with JWT verification enabled. The function authenticates the owner, reads that owner's saved bill under RLS, uploads the supplied PDF to Meta, then submits the PDF template.
5. In **Edge Function secrets**, set `META_PHONE_NUMBER_ID` and `META_ACCESS_TOKEN`. Supabase provides `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Never put the Meta token in browser code, GitHub, or chat.
6. Test with a bill addressed to your own WhatsApp number. Check the message and the attached PDF on the phone. A successful API response means Meta **accepted** the message; it is not proof of delivery.
7. Only after the test succeeds, change `window.SHOP_WHATSAPP_AUTO` to `true` in `dist/config.js` and redeploy GitHub Pages. The button then becomes **Send bill on WhatsApp**. Leave it `false` to retain the manual PDF download and WhatsApp handoff.

## Track delivery with Meta webhooks

8. Run [whatsapp_delivery.sql](whatsapp_delivery.sql) in the Supabase SQL Editor **before** redeploying `send-bill`. It stores Meta's message ID for the PDF; the owner can read only their own rows. Redeploy `send-bill` so it records that ID after Meta accepts the message.
9. Deploy [functions/whatsapp-webhook/index.ts](functions/whatsapp-webhook/index.ts) as `whatsapp-webhook` with **JWT verification disabled**. The setting is in [config.toml](config.toml) for CLI deployments; turn it off explicitly if deploying from the Supabase dashboard. Meta cannot supply a Supabase JWT. The function checks Meta's signature before accessing delivery data.
10. In Supabase **Edge Function secrets**, set `META_WEBHOOK_VERIFY_TOKEN` to a new random private string and `META_APP_SECRET` to the secret from the **same Meta developer app** (App settings → Basic). Set `META_PHONE_NUMBER_ID` to the shop's sending number ID. The function also needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; Supabase normally provides these to Edge Functions. Never put these secrets in GitHub, browser code, or chat.
11. In Meta **Configure Webhooks**, enter `https://<your-project-ref>.supabase.co/functions/v1/whatsapp-webhook` as **Callback URL** and the exact `META_WEBHOOK_VERIFY_TOKEN` value as **Verify token**, then click **Verify and save**. The URL must be the deployed function, not the GitHub Pages URL. Subscribe to the `messages` webhook field and turn on **Subscribe webhooks** for the shop's WhatsApp account. Publish the Meta app when Meta requires it for production events; its setup screen says unpublished apps receive only test webhooks.
12. Send one real bill to a number you control. In Supabase Table Editor, check `whatsapp_delivery`: a row should appear for that bill, then change from `accepted` to `sent`/`delivered`/`read` or `failed`. `error_code` records Meta's failure code. If the row stays `accepted`, check the webhook subscription and Edge Function logs. A `200` response from `send-bill` still means Meta accepted the message; delivery is confirmed only by a later webhook status.

The send function uses Graph API `v25.0`; review its supported version when Meta announces a retirement. Bill PDFs are generated in the browser and sent to the function only for this request. The bill data and delivery records remain in Supabase.

References: [Meta Cloud API examples](https://www.postman.com/meta/whatsapp-business-platform/overview), [document templates](https://whatsappbusiness.com/blog/manage-message-templates-whatsapp-business-api/), [messaging policy](https://whatsappbusiness.com/policy/), and [Supabase Edge Functions](https://supabase.com/docs/guides/functions).
