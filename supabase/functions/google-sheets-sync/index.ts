import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

async function decryptToken(packed: string) {
  const bytes = Uint8Array.from(atob(packed), c => c.charCodeAt(0));
  const keyBytes = Uint8Array.from(atob(Deno.env.get('TOKEN_ENCRYPTION_KEY')!), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return new TextDecoder().decode(clear);
}

async function encryptToken(value: string) {
  const keyBytes = Uint8Array.from(atob(Deno.env.get('TOKEN_ENCRYPTION_KEY')!), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value)));
  return btoa(String.fromCharCode(...iv, ...encrypted));
}

async function accessToken(db: ReturnType<typeof createClient>, userId: string) {
  const { data: credential, error } = await db.from('google_oauth_credentials').select('*').eq('user_id', userId).single();
  if (error || !credential) throw new Error('Google credentials missing');
  if (credential.access_token_encrypted && new Date(credential.access_token_expires_at).getTime() > Date.now() + 60000) return decryptToken(credential.access_token_encrypted);
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: Deno.env.get('GOOGLE_CLIENT_ID')!, client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!, refresh_token: await decryptToken(credential.refresh_token_encrypted), grant_type: 'refresh_token' }) });
  const tokens = await response.json();
  if (!response.ok) throw new Error('Google refresh failed');
  await db.from('google_oauth_credentials').update({ access_token_encrypted: await encryptToken(tokens.access_token), access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(), status: 'active', updated_at: new Date().toISOString() }).eq('user_id', userId);
  return tokens.access_token as string;
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('SYNC_CRON_SECRET')) return new Response('Unauthorized', { status: 401 });
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: connections, error } = await db.from('google_sheet_connections').select('*').eq('sync_status', 'active');
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const results = [];

  for (const connection of connections ?? []) {
    try {
      const token = await accessToken(db, connection.user_id);
      const range = encodeURIComponent(`'${connection.sheet_name.replaceAll("'", "''")}'!A${connection.last_synced_row + 1}:ZZ`);
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}/values/${range}`, { headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 401) {
        await db.from('google_sheet_connections').update({ sync_status: 'reconnect_required', last_error: 'Google authorization expired' }).eq('id', connection.id);
        continue;
      }
      if (!response.ok) throw new Error(`Google API ${response.status}`);
      const rows: unknown[][] = (await response.json()).values ?? [];
      const headerRange = encodeURIComponent(`'${connection.sheet_name.replaceAll("'", "''")}'!1:1`);
      const headerResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheet_id}/values/${headerRange}`, { headers: { Authorization: `Bearer ${token}` } });
      const headers: string[] = (await headerResponse.json()).values?.[0] ?? [];
      const leads = rows.map((row, offset) => {
        const lead: Record<string, unknown> = { organization_id: connection.organization_id, user_id: connection.user_id, google_sheet_connection_id: connection.id, google_sheet_row: connection.last_synced_row + offset + 1 };
        headers.forEach((header, index) => { const destination = connection.field_mapping[header]; if (destination && row[index] != null) lead[destination] = row[index]; });
        return lead;
      });
      if (leads.length) {
        const { error: insertError } = await db.from('leads').upsert(leads, { onConflict: 'google_sheet_connection_id,google_sheet_row', ignoreDuplicates: true });
        if (insertError) throw insertError;
      }
      await db.from('google_sheet_connections').update({ last_synced_row: connection.last_synced_row + rows.length, last_synced_at: new Date().toISOString(), last_error: null }).eq('id', connection.id);
      results.push({ id: connection.id, imported: rows.length });
    } catch (syncError) {
      await db.from('google_sheet_connections').update({ sync_status: 'error', last_error: syncError instanceof Error ? syncError.message : 'Unknown error' }).eq('id', connection.id);
    }
  }
  return Response.json({ results });
});
