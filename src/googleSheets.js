const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly';

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function authorizeGoogle() {
  if (!GOOGLE_CLIENT_ID) throw new Error('أضف VITE_GOOGLE_CLIENT_ID إلى ملف البيئة');
  await loadScript('https://accounts.google.com/gsi/client');
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: (response) => response.error ? reject(response) : resolve(response.access_token),
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

export async function listSpreadsheets(accessToken) {
  const params = new URLSearchParams({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
    fields: 'files(id,name,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: '50',
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error('تعذّر تحميل ملفات Google Sheets');
  return (await response.json()).files;
}

export async function getSpreadsheetTabs(accessToken, spreadsheetId) {
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error('تعذّر تحميل الصفحات');
  return (await response.json()).sheets.map(({ properties }) => properties);
}

export async function getHeaders(accessToken, spreadsheetId, sheetTitle) {
  const range = encodeURIComponent(`'${sheetTitle.replaceAll("'", "''")}'!1:1`);
  const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error('تعذّرت قراءة عناوين الأعمدة');
  return (await response.json()).values?.[0] ?? [];
}
