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
  const wahaUrl = Deno.env.get('WAHA_URL');
  const wahaKey = Deno.env.get('WAHA_API_KEY');
  const session = Deno.env.get('WAHA_SESSION');
  if (!url || !key || !wahaUrl || !wahaKey || !session) return reply(500, 'Server settings are incomplete');

  try {
    const { billId, pdf } = await request.json();
    if (typeof billId !== 'string') return reply(400, 'Bill ID required');
    if (typeof pdf !== 'string' || pdf.length > 6_700_000 || !pdf.startsWith('JVBERi0') || !/^[A-Za-z0-9+/]+={0,2}$/.test(pdf)) return reply(400, 'Valid bill PDF required');
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
    const chatId = `${phone.length === 10 ? '91' + phone : phone}@c.us`;
    const apiUrl = wahaUrl.replace(/\/$/, '');
    const wahaHeaders = { 'Content-Type': 'application/json', 'X-Api-Key': wahaKey };
    const sent = await fetch(`${apiUrl}/api/sendText`, {
      method: 'POST',
      headers: wahaHeaders,
      body: JSON.stringify({ chatId, text: 'Thank you for shopping with Maharashtra Dry Cleaners. Your bill is attached below.', session }),
    });
    if (!sent.ok) return reply(502, `WAHA could not send the thank-you message (${sent.status})`);
    let attachment;
    try {
      attachment = await fetch(`${apiUrl}/api/sendFile`, {
        method: 'POST',
        headers: wahaHeaders,
        body: JSON.stringify({ chatId, session, file: { mimetype: 'application/pdf', filename: `Bill-${billId}.pdf`, data: pdf } }),
      });
    } catch {
      return reply(502, 'Thank-you sent, but the PDF could not be sent. Attach the bill manually.');
    }
    if (!attachment.ok) return reply(502, `Thank-you sent, but the PDF failed (${attachment.status}). Attach the bill manually.`);
    return reply(200, 'Thank-you message and bill PDF sent');
  } catch {
    return reply(500, 'Could not send bill');
  }
});
