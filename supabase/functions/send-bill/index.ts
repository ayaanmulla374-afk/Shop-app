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
    const { billId } = await request.json();
    if (typeof billId !== 'string') return reply(400, 'Bill ID required');
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
    const amount = (value: number) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    const lines = bill.lines.map((line: { name: string; qty: number; rate: number }) =>
      `${line.name}: ${line.qty} × ${amount(line.rate)} = ${amount(line.qty * line.rate)}`,
    ).join('\n');
    const period = bill.date ? new Date(`${bill.date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : `${bill.from} to ${bill.to}`;
    const message = `Maharashtra Dry Cleaners\nBill for ${bill.name}${bill.flat ? ` (Flat ${bill.flat})` : ''}\n${period}\n${lines}\nTotal: ${amount(bill.total)}`;
    const sent = await fetch(`${wahaUrl.replace(/\/$/, '')}/api/sendText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': wahaKey },
      body: JSON.stringify({ chatId: `${phone.length === 10 ? '91' + phone : phone}@c.us`, text: message, session }),
    });
    if (!sent.ok) return reply(502, `WAHA could not send the message (${sent.status})`);
    return reply(200, 'Bill sent');
  } catch {
    return reply(500, 'Could not send bill');
  }
});
