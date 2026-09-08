import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const scopes = ['https://www.googleapis.com/auth/drive.readonly', 'https://www.googleapis.com/auth/spreadsheets.readonly'];
const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/google-sheets-connect`;
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function json(body: unknown, status = 200) { return Response.json(body, { status, headers: cors }); }
function html(ok: boolean, origin: string, message = '') {
  const payload = JSON.stringify({ type: 'raa-google-oauth', ok, error: ok ? undefined : message }).replaceAll('<', '\\u003c');
  return new Response(`<!doctype html><meta charset="utf-8"><title>راء</title><script>window.opener?.postMessage(${payload},${JSON.stringify(origin)});window.close()</script><p dir="rtl">يمكنك إغلاق هذه النافذة والعودة إلى منصة راء.</p>`, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
async function key() {
  const bytes = Uint8Array.from(atob(Deno.env.get('TOKEN_ENCRYPTION_KEY')!), c => c.charCodeAt(0));
  if (bytes.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must decode to 32 bytes');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), new TextEncoder().encode(value)));
  return btoa(String.fromCharCode(...iv, ...encrypted));
}
async function decrypt(value: string) {
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await key(), bytes.slice(12));
  return new TextDecoder().decode(clear);
}
async function googleToken(userId: string) {
  const { data, error } = await admin.from('google_oauth_credentials').select('*').eq('user_id', userId).single();
  if (error || !data) throw new Error('أعد ربط حساب Google');
  if (data.access_token_encrypted && new Date(data.access_token_expires_at).getTime() > Date.now() + 60000) return decrypt(data.access_token_encrypted);
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!, refresh_token: await decrypt(data.refresh_token_encrypted), grant_type: 'refresh_token' }) });
  const tokens = await response.json();
  if (!response.ok) { await admin.from('google_oauth_credentials').update({ status: 'reconnect_required' }).eq('user_id', userId); throw new Error('انتهى تفويض Google. أعد الربط'); }
  await admin.from('google_oauth_credentials').update({ access_token_encrypted: await encrypt(tokens.access_token), access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), status: 'active', updated_at: new Date().toISOString() }).eq('user_id', userId);
  return tokens.access_token;
}
async function google(url: string, token: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`تعذّر قراءة Google (${response.status})`);
  return response.json();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  if (req.method === 'GET' && (url.searchParams.has('code') || url.searchParams.has('error'))) {
    const state = url.searchParams.get('state') ?? '';
    const { data: pending } = await admin.from('google_oauth_states').delete().eq('state', state).gt('expires_at', new Date().toISOString()).select().maybeSingle();
    if (!pending) return html(false, '*', 'طلب التفويض غير صالح أو منتهي');
    if (url.searchParams.has('error')) return html(false, pending.return_origin, 'تم إلغاء تفويض Google');
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: url.searchParams.get('code')!, client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!, redirect_uri: redirectUri, grant_type: 'authorization_code' }) });
    const tokens = await response.json();
    if (!response.ok || !tokens.refresh_token) return html(false, pending.return_origin, 'لم تمنح Google رمز تجديد. ألغِ وصول التطبيق ثم حاول مجدداً');
    await admin.from('google_oauth_credentials').upsert({ user_id: pending.user_id, refresh_token_encrypted: await encrypt(tokens.refresh_token), access_token_encrypted: await encrypt(tokens.access_token), access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), status: 'active', updated_at: new Date().toISOString() });
    return html(true, pending.return_origin);
  }
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await client.auth.getUser();
    if (!user) return json({ error: 'غير مصرح' }, 401);
    const body = await req.json();
    if (body.action === 'authorize') {
      const allowed = (Deno.env.get('APP_ALLOWED_ORIGINS') ?? '').split(',').map(v => v.trim()).filter(Boolean);
      if (!allowed.includes(body.returnOrigin)) throw new Error('نطاق التطبيق غير مسموح');
      const state = crypto.randomUUID() + crypto.randomUUID();
      const { error } = await admin.from('google_oauth_states').insert({ state, user_id: user.id, return_origin: body.returnOrigin, expires_at: new Date(Date.now() + 10 * 60_000).toISOString() });
      if (error) throw error;
      const params = new URLSearchParams({ client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, redirect_uri: redirectUri, response_type: 'code', scope: scopes.join(' '), access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state });
      return json({ authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    }
    const token = await googleToken(user.id);
    if (body.action === 'list_files') {
      const params = new URLSearchParams({ q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false", fields: 'files(id,name,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: '100' });
      return json({ files: (await google(`https://www.googleapis.com/drive/v3/files?${params}`, token)).files ?? [] });
    }
    if (!body.spreadsheetId) throw new Error('معرّف الملف مطلوب');
    if (body.action === 'list_tabs') {
      const data = await google(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(body.spreadsheetId)}?fields=sheets.properties`, token);
      return json({ tabs: data.sheets?.map((s: { properties: unknown }) => s.properties) ?? [] });
    }
    if (body.action === 'get_headers') {
      const range = encodeURIComponent(`'${String(body.sheetName).replaceAll("'", "''")}'!1:1`);
      return json({ headers: (await google(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(body.spreadsheetId)}/values/${range}`, token)).values?.[0] ?? [] });
    }
    if (body.action === 'save_mapping') {
      const destinations = Object.values(body.mapping ?? {}).filter(Boolean);
      const allowed = ['full_name', 'phone', 'email', 'service', 'doctor', 'source', 'notes'];
      if (!destinations.length || destinations.some(v => !allowed.includes(String(v))) || new Set(destinations).size !== destinations.length) throw new Error('مطابقة الحقول غير صالحة أو مكررة');
      const { data: profile, error: profileError } = await client.from('profiles').select('organization_id').eq('id', user.id).single();
      if (profileError || !profile?.organization_id) throw new Error('حسابك غير مرتبط بعيادة');
      const { data, error } = await client.from('google_sheet_connections').upsert({ organization_id: profile.organization_id, user_id: user.id, spreadsheet_id: body.spreadsheetId, spreadsheet_name: body.spreadsheetName, sheet_name: body.sheetName, field_mapping: body.mapping, last_synced_row: 1, sync_status: 'active', last_error: null }, { onConflict: 'user_id,spreadsheet_id,sheet_name' }).select('id').single();
      if (error) throw error; return json(data);
    }
    return json({ error: 'إجراء غير مدعوم' }, 400);
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'خطأ غير متوقع' }, 400); }
});
