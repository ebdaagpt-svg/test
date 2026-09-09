const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const scopes = 'https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/spreadsheets.readonly';

export const hasGoogleConfig = Boolean(clientId && !clientId.includes('your-'));

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const existing = document.querySelector('script[data-google-oauth]');
    if (existing) { existing.addEventListener('load', resolve, { once: true }); return; }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client'; script.dataset.googleOauth = 'true';
    script.onload = resolve; script.onerror = () => reject(new Error('تعذّر تحميل خدمة Google'));
    document.head.appendChild(script);
  });
}

export async function connectGoogle() {
  if (!hasGoogleConfig) throw new Error('لم يتم إعداد Google OAuth بعد. أضف VITE_GOOGLE_CLIENT_ID ثم أعد نشر التطبيق.');
  await loadGoogleScript();
  const token = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: scopes, callback: response => response.error ? reject(new Error(response.error_description || response.error)) : resolve(response.access_token) });
    client.requestAccessToken({ prompt: 'select_account consent' });
  });
  return { token };
}

async function request(url, token, message) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(response.status === 401 ? 'انتهت جلسة Google. سجّل الدخول مرة أخرى.' : message);
  return response.json();
}

export async function listSpreadsheets(token) {
  const params = new URLSearchParams({ q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and 'me' in owners", fields: 'files(id,name,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: '100' });
  return (await request(`https://www.googleapis.com/drive/v3/files?${params}`, token, 'تعذّر جلب ملفات Google Sheets')).files ?? [];
}

export async function listTabs(token, spreadsheetId) {
  const data = await request(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties`, token, 'تعذّر جلب صفحات الملف');
  return data.sheets?.map(sheet => sheet.properties) ?? [];
}

export async function readSheet(token, spreadsheetId, sheetName) {
  const range = encodeURIComponent(`'${sheetName.replaceAll("'", "''")}'!A:ZZ`);
  return (await request(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`, token, 'تعذّرت قراءة بيانات الصفحة')).values ?? [];
}
