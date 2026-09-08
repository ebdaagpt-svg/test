const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const previewBypass = import.meta.env.DISABLE_AUTH_CHECK_FOR_PREVIEW === 'true';
const scopes = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/spreadsheets.readonly';

export const hasGoogleConfig = !previewBypass && Boolean(clientId && !clientId.includes('your-'));

const mockFiles = [
  { id: 'mock-leads', name: 'Leads — September 2026', modifiedTime: '2026-09-08T12:00:00Z' },
  { id: 'mock-campaigns', name: 'Campaign Performance', modifiedTime: '2026-09-06T09:30:00Z' },
];
const mockSheets = {
  'mock-leads': {
    tabs: [{ sheetId: 0, title: 'العملاء الجدد' }, { sheetId: 1, title: 'تم التواصل' }],
    data: {
      'العملاء الجدد': [['الاسم', 'رقم الهاتف', 'الخدمة', 'المصدر', 'تاريخ التسجيل'], ['سارة أحمد', '010 2456 7890', 'استشارة', 'Meta', '08/09/2026'], ['عمر خالد', '011 9823 4410', 'تقويم أسنان', 'TikTok', '08/09/2026'], ['نور محمد', '012 3367 9012', 'جلسة ليزر', 'Snapchat', '07/09/2026'], ['يوسف علي', '015 7344 1288', 'كشف أولي', 'Meta', '07/09/2026']],
      'تم التواصل': [['الاسم', 'الحالة', 'الموظف', 'آخر تحديث'], ['مريم حسن', 'موعد مؤكد', 'دينا', '06/09/2026'], ['أحمد سمير', 'إعادة اتصال', 'محمد', '05/09/2026']],
    },
  },
  'mock-campaigns': {
    tabs: [{ sheetId: 0, title: 'ملخص الحملات' }],
    data: { 'ملخص الحملات': [['الحملة', 'المنصة', 'العملاء', 'التكلفة', 'الحالة'], ['ابتسامة جديدة', 'Meta', '142', '12,450 ج.م', 'نشطة'], ['عروض سبتمبر', 'TikTok', '87', '8,920 ج.م', 'نشطة'], ['احجز الآن', 'Snapchat', '64', '6,210 ج.م', 'متوقفة']] },
  },
};

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
  if (previewBypass || !hasGoogleConfig) return { mode: 'mock', token: null };
  await loadGoogleScript();
  const token = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: scopes, callback: response => response.error ? reject(new Error(response.error_description || response.error)) : resolve(response.access_token) });
    client.requestAccessToken({ prompt: 'consent' });
  });
  return { mode: 'google', token };
}

async function request(url, token, message) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(response.status === 401 ? 'انتهت جلسة Google. سجّل الدخول مرة أخرى.' : message);
  return response.json();
}

export async function listSpreadsheets(mode, token) {
  if (mode === 'mock') return mockFiles;
  const params = new URLSearchParams({ q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false", fields: 'files(id,name,modifiedTime)', orderBy: 'modifiedTime desc', pageSize: '100' });
  return (await request(`https://www.googleapis.com/drive/v3/files?${params}`, token, 'تعذّر جلب ملفات Google Sheets')).files ?? [];
}

export async function listTabs(mode, token, spreadsheetId) {
  if (mode === 'mock') return mockSheets[spreadsheetId]?.tabs ?? [];
  const data = await request(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties`, token, 'تعذّر جلب صفحات الملف');
  return data.sheets?.map(sheet => sheet.properties) ?? [];
}

export async function readSheet(mode, token, spreadsheetId, sheetName) {
  if (mode === 'mock') return mockSheets[spreadsheetId]?.data[sheetName] ?? [];
  const range = encodeURIComponent(`'${sheetName.replaceAll("'", "''")}'!A:ZZ`);
  return (await request(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`, token, 'تعذّرت قراءة بيانات الصفحة')).values ?? [];
}
