# Supabase and automatic WhatsApp bills

The live site already has a Supabase Project URL and publishable key in `dist/config.js`. Owner sign-in and bill saving use the `shop_state` table defined in [schema.sql](schema.sql). Keep RLS enabled. The current WhatsApp action remains manual until the steps below are complete.

## Prepare Meta WhatsApp Business Platform

1. Set up direct Cloud API access for the shop's WhatsApp Business number in Meta Business Manager. Confirm that the number can use the Business app and Platform together if you need both. Obtain its **Phone Number ID** and an access token with permission to send WhatsApp messages. Keep the token private.
2. In WhatsApp Manager, create and get approval for these **Utility** templates in language code `en`:
   - `bill_thank_you`: text body `Thank you for shopping with Maharashtra Dry Cleaners. Your bill is attached below.`
   - `bill_pdf`: **document header** and text body such as `Your bill from Maharashtra Dry Cleaners is attached.`
   The names, language, and document header must match the code. Meta may classify or reject a template; check its approved status before continuing. Collect the customer's agreement to receive bills on WhatsApp.
3. Add a payment method in Meta if required for business-initiated messages. Confirm the phone number can send an approved template to your own test number.

## Deploy the send function

4. In Supabase **Edge Functions**, deploy [functions/send-bill/index.ts](functions/send-bill/index.ts) as `send-bill`, with JWT verification enabled. The function authenticates the owner, reads that owner's saved bill under RLS, uploads the supplied PDF to Meta, then submits the thank-you template and PDF template in that order.
5. In **Edge Function secrets**, set `META_PHONE_NUMBER_ID` and `META_ACCESS_TOKEN`. Supabase provides `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Never put the Meta token in browser code, GitHub, or chat.
6. Test with a bill addressed to your own WhatsApp number. Check both messages and the attached PDF on the phone. A successful API response means Meta **accepted** the messages; it is not proof of delivery. If the thank-you succeeds but the PDF fails, the function reports that partial failure so you can send the PDF manually.
7. Only after the test succeeds, change `window.SHOP_WHATSAPP_AUTO` to `true` in `dist/config.js` and redeploy GitHub Pages. The button then becomes **Send bill on WhatsApp**. Leave it `false` to retain the manual PDF download and WhatsApp handoff.

The function uses Graph API `v25.0`; review its supported version when Meta announces a retirement. Bill PDFs are generated in the browser and sent to the function only for this request. The bill data remains in Supabase.

References: [Meta Cloud API examples](https://www.postman.com/meta/whatsapp-business-platform/overview), [document templates](https://whatsappbusiness.com/blog/manage-message-templates-whatsapp-business-api/), [messaging policy](https://whatsappbusiness.com/policy/), and [Supabase Edge Functions](https://supabase.com/docs/guides/functions).
