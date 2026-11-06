(async () => {
  const config = window.SHOP_SUPABASE;
  if (!config?.url || !config?.key) return;
  const gate = $('cloudGate');
  gate.classList.remove('hidden');
  if (!window.supabase?.createClient) {
    $('cloudStatus').textContent = 'Could not load Supabase. Check your internet connection.';
    return;
  }
  if (!/^https:\/\/[^/]+\.supabase\.co\/?$/.test(config.url) || !config.key.startsWith('sb_publishable_')) {
    $('cloudStatus').textContent = 'Check the Project URL and publishable key in config.js.';
    return;
  }
  const client = window.supabase.createClient(config.url.replace(/\/$/, ''), config.key);

  async function openShop() {
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) throw Error('Sign in again.');
    const { data: row, error } = await client.from('shop_state').select('data').eq('owner_id', auth.user.id).maybeSingle();
    if (error) throw error;
    const local = JSON.parse(localStorage.getItem(key) || '{"prices":{},"bills":[]}');
    let state = row?.data || { prices: {}, bills: [] };
    const existingIds = new Set(state.bills.map(b => b.id));
    const missingBills = (local.bills || []).filter(b => !existingIds.has(b.id));
    const customItems = { ...local.customItems, ...state.customItems };
    for (const section of Object.keys(local.customItems || {})) {
      customItems[section] = [...new Set([...(state.customItems?.[section] || []), ...local.customItems[section]])];
    }
    if (!row || missingBills.length || Object.keys(local.prices || {}).some(name => !(name in state.prices)) || Object.keys(local.customItems || {}).length) {
      state = { ...state, bills: [...state.bills, ...missingBills], prices: { ...local.prices, ...state.prices }, customItems };
      const { error: saveError } = await client.from('shop_state').upsert({ owner_id: auth.user.id, data: state });
      if (saveError) throw saveError;
    }
    cloudClient = client;
    cloudUser = auth.user;
    loadCloudData(state);
    $('sendBill').textContent = window.SHOP_WHATSAPP_AUTO ? 'Send bill on WhatsApp' : 'Open in WhatsApp';
    $('cloudEmail').value = auth.user.email || '';
    $('cloudPassword').value = '';
    gate.classList.add('hidden');
    document.documentElement.classList.remove('cloud-enabled');
    if (missingBills.length) showStatus('billStatus', `${missingBills.length} browser bill(s) copied to Supabase.`);
  }

  $('cloudSignIn').onclick = async () => {
    $('cloudStatus').textContent = 'Signing in…';
    const { error } = await client.auth.signInWithPassword({ email: $('cloudEmail').value.trim(), password: $('cloudPassword').value });
    if (error) { $('cloudStatus').textContent = error.message; return; }
    try { await openShop(); } catch (e) { $('cloudStatus').textContent = e.message; }
  };
  const signOut = document.createElement('button');
  signOut.className = 'btn ghost';
  signOut.textContent = 'Sign out';
  signOut.onclick = async () => { await client.auth.signOut(); sessionStorage.removeItem(draftKey); location.reload(); };
  $('settings').querySelector('.card').append(signOut);
  try { await openShop(); } catch { $('cloudStatus').textContent = 'Sign in to open your shop data.'; }
})();
