# Maharashtra Dry Cleaners Billing

[Open the live billing site](https://ayaanmulla374-afk.github.io/Shop-app/).

The shop owner signs in through Supabase, sets prices, creates bills, and reopens saved bills. **Save bill** writes the bill to the owner's Supabase `shop_state` row. The print button uses the same invoice layout shown in the downloaded PDF.

**Open in WhatsApp** currently downloads the PDF and opens a prepared thank-you message for manual sending. Automatic sending is prepared but disabled until the Meta WhatsApp Business Platform is configured and tested. Once enabled, **Send bill on WhatsApp** saves the bill, uploads its PDF to Meta, then sends an approved PDF template. See [supabase/SETUP.md](supabase/SETUP.md).

## Run locally

The site is plain HTML, CSS, and JavaScript. Serve `dist/` with a local web server; no build step or package install is needed:

```sh
python -m http.server 8000 --directory dist
```

Open `http://localhost:8000`. The published Supabase login expects the GitHub Pages origin for the send function, so local testing of automatic sending needs an explicit test environment. Do not put Meta tokens or Supabase secret keys in `dist/` or GitHub.
