import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401, headers: cors });
    const { googleAccessToken, spreadsheetId, spreadsheetName, sheetName, mapping } = await req.json();
    if (!googleAccessToken || !spreadsheetId || !sheetName || !mapping) throw new Error('بيانات الاتصال غير مكتملة');

    // Token encryption is intentionally performed server-side. TOKEN_ENCRYPTION_KEY
    // must be a 32-byte secret and is never exposed to the browser.
    const keyBytes = Uint8Array.from(atob(Deno.env.get('TOKEN_ENCRYPTION_KEY')!), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(googleAccessToken)));
    const packed = btoa(String.fromCharCode(...iv, ...encrypted));

    const { data, error } = await supabase.from('google_sheet_connections').upsert({
      user_id: user.id, spreadsheet_id: spreadsheetId, spreadsheet_name: spreadsheetName,
      sheet_name: sheetName, field_mapping: mapping, encrypted_access_token: packed,
      last_synced_row: 1, sync_status: 'active', last_error: null,
    }, { onConflict: 'user_id,spreadsheet_id,sheet_name' }).select('id').single();
    if (error) throw error;
    return Response.json(data, { headers: cors });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 400, headers: cors });
  }
});
