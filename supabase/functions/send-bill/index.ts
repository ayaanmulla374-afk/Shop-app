const allowedOrigin = 'https://ayaanmulla374-afk.github.io';
const headers = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

function reply(status: number, message: string) {
  return new Response(JSON.stringify({ message }), { status, headers });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers });
  if (request.method !== 'POST') return reply(405, 'Method not allowed');
  if (request.headers.get('Origin') !== allowedOrigin) return reply(403, 'Origin not allowed');

  const token = request.headers.get('Authorization')?.replace(/^Bearer /i, '');
  if (!token) return reply(401, 'Sign in first');
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_ANON_KEY');
  const phoneId = Deno.env.get('META_PHONE_NUMBER_ID');
  const metaToken = Deno.env.get('META_ACCESS_TOKEN');
  if (!url || !key || !phoneId || !metaToken) return reply(500, 'Server settings are incomplete');
  if (!/^\d+$/.test(phoneId)) return reply(500, 'Meta phone number ID is invalid');

  try {
    const { billId, pdf } = await request.json();
    if (typeof billId !== 'string' || !billId) return reply(400, 'Bill ID required');
    if (typeof pdf !== 'string' || pdf.length > 6_700_000 || pdf.length % 4 || !pdf.startsWith('JVBERi0') || !/^[A-Za-z0-9+/]+={0,2}$/.test(pdf)) return reply(400, 'Valid bill PDF required');
    const authHeaders = { apikey: key, Authorization: `Bearer ${token}` };
    const userResponse = await fetch(`${url}/auth/v1/user`, { headers: authHeaders });
    if (!userResponse.ok) return reply(401, 'Sign in again');
    const user = await userResponse.json();
    const stateResponse = await fetch(`${url}/rest/v1/shop_state?owner_id=eq.${encodeURIComponent(user.id)}&select=data`, { headers: authHeaders });
    if (!stateResponse.ok) return reply(500, 'Could not load bill');
    const rows = await stateResponse.json();
    const bill = rows[0]?.data?.bills?.find((item: { id: string }) => item.id === billId);
    if (!bill) return reply(404, 'Bill not found');
    const phone = String(bill.phone || '').replace(/\D/g, '');
    if (!/^(91)?[6-9]\d{9}$/.test(phone)) return reply(400, 'Bill needs a valid WhatsApp number');
    const to = phone.length === 10 ? `91${phone}` : phone;
    const endpoint = `https://graph.facebook.com/v25.0/${phoneId}`;
    const metaHeaders = { Authorization: `Bearer ${metaToken}` };

    const media = new FormData();
    media.append('messaging_product', 'whatsapp');
    media.append('file', new Blob([Uint8Array.from(atob(pdf), c => c.charCodeAt(0))], { type: 'application/pdf' }), `Bill-${billId}.pdf`);
    const upload = await fetch(`${endpoint}/media`, { method: 'POST', headers: metaHeaders, body: media });
    if (!upload.ok) return reply(502, `Meta could not upload the PDF (${upload.status})`);
    const mediaId = (await upload.json()).id;
    if (!mediaId) return reply(502, 'Meta did not return a PDF media ID');

    const send = (template: object) => fetch(`${endpoint}/messages`, {
      method: 'POST', headers: { ...metaHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'template', template }),
    });
    let trackingOk = true;
    const track = async (response: Response, part: string) => {
      try {
        const messageId = (await response.json()).messages?.[0]?.id;
        if (!messageId) { trackingOk = false; return; }
        const saved = await fetch(`${url}/rest/v1/whatsapp_delivery`, {
          method: 'POST', headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message_id: messageId, owner_id: user.id, bill_id: billId, part }),
        });
        if (!saved.ok) trackingOk = false;
      } catch { trackingOk = false; }
    };
    const sentText = await send({ name: 'bill_thank_you', language: { code: 'en' } });
    if (!sentText.ok) return reply(502, `Meta could not send the thank-you message (${sentText.status})`);
    await track(sentText, 'thank_you');
    let document;
    try {
      document = await send({ name: 'bill_pdf', language: { code: 'en' }, components: [{ type: 'header', parameters: [{ type: 'document', document: { id: mediaId, filename: `Bill-${billId}.pdf` } }] }] });
    } catch {
      return reply(502, 'Thank-you sent, but the PDF could not be sent. Send the PDF manually.');
    }
    if (!document.ok) return reply(502, `Thank-you sent, but the PDF failed (${document.status}). Send the PDF manually.`);
    await track(document, 'pdf');
    return reply(200, trackingOk ? 'Thank-you message and bill PDF accepted by Meta' : 'Meta accepted both messages, but delivery tracking could not be saved. Check the recipient phone.');
  } catch {
    return reply(500, 'Could not send bill');
  }
});
