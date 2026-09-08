import { useMemo, useState } from 'react';
import { Bell, Check, ChevronDown, CircleHelp, Database, FileSpreadsheet, LayoutGrid, Link2, LogOut, Menu, RefreshCw, Settings, Users, X } from 'lucide-react';
import { authorizeGoogle, getHeaders, getSpreadsheetTabs, listSpreadsheets } from './googleSheets';
import { supabase } from './supabase';

const platformFields = [
  { value: '', label: 'تجاهل هذا الحقل' }, { value: 'full_name', label: 'الاسم الكامل' },
  { value: 'phone', label: 'رقم الهاتف' }, { value: 'email', label: 'البريد الإلكتروني' },
  { value: 'service', label: 'الخدمة' }, { value: 'doctor', label: 'الطبيب' },
  { value: 'source', label: 'مصدر العميل' }, { value: 'notes', label: 'ملاحظات' },
];
const sampleHeaders = ['الاسم', 'رقم الجوال', 'الخدمة المطلوبة', 'الطبيب', 'الحملة الإعلانية'];
const defaultMap = { الاسم: 'full_name', 'رقم الجوال': 'phone', 'الخدمة المطلوبة': 'service', الطبيب: 'doctor', 'الحملة الإعلانية': 'source' };

export function App() {
  const [step, setStep] = useState(1);
  const [token, setToken] = useState('');
  const [files, setFiles] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [file, setFile] = useState(null);
  const [tab, setTab] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const mappedCount = useMemo(() => Object.values(mapping).filter(Boolean).length, [mapping]);
  const run = async (work) => { setLoading(true); setError(''); try { await work(); } catch (e) { setError(e.message || 'حدث خطأ غير متوقع'); } finally { setLoading(false); } };

  const connect = () => run(async () => {
    try {
      const accessToken = await authorizeGoogle();
      setToken(accessToken); setFiles(await listSpreadsheets(accessToken)); setStep(2);
    } catch (e) {
      if (e.message?.includes('VITE_GOOGLE')) {
        setToken('demo'); setFiles([{ id: 'demo', name: 'Leads - September 2026', modifiedTime: new Date().toISOString() }]); setStep(2);
      } else throw e;
    }
  });
  const chooseFile = (selected) => run(async () => {
    setFile(selected);
    const result = token === 'demo' ? [{ sheetId: 0, title: 'عملاء الإعلانات' }, { sheetId: 1, title: 'الأرشيف' }] : await getSpreadsheetTabs(token, selected.id);
    setTabs(result); setTab(null);
  });
  const continueToMapping = () => run(async () => {
    const result = token === 'demo' ? sampleHeaders : await getHeaders(token, file.id, tab.title);
    setHeaders(result); setMapping(Object.fromEntries(result.map(h => [h, defaultMap[h] ?? '']))); setStep(3);
  });
  const save = () => run(async () => {
    if (mappedCount === 0) throw new Error('طابق حقلاً واحداً على الأقل للمتابعة');
    if (token !== 'demo') {
      if (!supabase) throw new Error('أضف إعدادات Supabase إلى ملف البيئة');
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-sheets-connect`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token ?? ''}` },
        body: JSON.stringify({ googleAccessToken: token, spreadsheetId: file.id, spreadsheetName: file.name, sheetName: tab.title, mapping }),
      });
      if (!response.ok) throw new Error('تعذّر حفظ إعدادات المزامنة');
    }
    setSaved(true); setStep(4);
  });

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span>ر</span><div><strong>راء</strong><small>إدارة العيادات</small></div></div>
      <nav><a><LayoutGrid/>الرئيسية</a><a><Users/>العملاء المحتملون</a><a className="active"><Link2/>التكاملات</a><a><Database/>مصادر البيانات</a><a><Settings/>الإعدادات</a></nav>
      <div className="sidebar-help"><CircleHelp/><strong>تحتاج مساعدة؟</strong><small>تواصل مع فريق الدعم</small><button>مركز المساعدة</button></div>
      <div className="profile"><div className="avatar">من</div><div><b>محمد النعيمي</b><small>مدير الحساب</small></div><LogOut/></div>
    </aside>
    <main>
      <header><button className="icon mobile"><Menu/></button><div className="header-actions"><button className="icon"><Bell/><i/></button><div className="avatar">من</div><ChevronDown/></div></header>
      <section className="page">
        <div className="crumb">التكاملات <span>/</span> Google Sheets</div>
        <div className="title-row"><div><h1>ربط Google Sheets</h1><p>اربط ملفك واستقبل العملاء المحتملين تلقائياً في منصة راء.</p></div><span className="secure"><Check/> اتصال آمن ومشفّر</span></div>
        <div className="steps">
          {['ربط حساب Google', 'اختيار الملف والصفحة', 'مطابقة الحقول', 'تفعيل المزامنة'].map((label, i) => <div className={`${step > i + 1 ? 'done' : ''} ${step === i + 1 ? 'current' : ''}`} key={label}><span>{step > i + 1 ? <Check/> : i + 1}</span><b>{label}</b></div>)}
        </div>
        {error && <div className="error"><X/>{error}</div>}
        <div className="card">
          {step === 1 && <div className="center-panel"><div className="google-sheet"><FileSpreadsheet/></div><h2>ابدأ بربط حساب Google</h2><p>سنطلب صلاحية القراءة فقط لملفات Google Sheets. لن نقوم بتعديل أو حذف أي بيانات من حسابك.</p><button className="google-btn" onClick={connect} disabled={loading}><span className="google-g">G</span>{loading ? 'جارٍ الاتصال...' : 'المتابعة باستخدام Google'}</button><div className="permission"><Check/><span><b>صلاحية قراءة فقط</b><small>يمكنك إلغاء الربط في أي وقت من الإعدادات.</small></span></div></div>}
          {step === 2 && <div className="form-panel"><div className="section-heading"><div className="sheet-small"><FileSpreadsheet/></div><div><h2>اختر ملف Google Sheets</h2><p>حدد الملف والصفحة التي تصل إليها بيانات العملاء الجدد.</p></div></div><label>ملف Google Sheets</label><div className="file-list">{files.map(f => <button className={file?.id === f.id ? 'selected' : ''} onClick={() => chooseFile(f)} key={f.id}><FileSpreadsheet/><span><b>{f.name}</b><small>آخر تعديل {new Date(f.modifiedTime).toLocaleDateString('ar-SA')}</small></span>{file?.id === f.id && <Check/>}</button>)}</div>{file && <><label>الصفحة (Tab)</label><select value={tab?.sheetId ?? ''} onChange={e => setTab(tabs.find(t => String(t.sheetId) === e.target.value))}><option value="">اختر الصفحة</option>{tabs.map(t => <option value={t.sheetId} key={t.sheetId}>{t.title}</option>)}</select></>}<div className="card-footer"><button className="secondary" onClick={() => setStep(1)}>السابق</button><button className="primary" disabled={!file || !tab || loading} onClick={continueToMapping}>{loading ? 'جارٍ قراءة العناوين...' : 'متابعة'}</button></div></div>}
          {step === 3 && <div className="form-panel mapping"><div className="section-heading"><div className="sheet-small"><RefreshCw/></div><div><h2>طابق حقول البيانات</h2><p>اختر الحقل المناظر في منصة راء لكل عمود من ملفك.</p></div><span className="count">{mappedCount} من {headers.length} حقول</span></div><div className="mapping-head"><span>عمود Google Sheets</span><span>حقل منصة راء</span></div>{headers.map((h, i) => <div className="mapping-row" key={`${h}-${i}`}><div><span className="col-letter">{String.fromCharCode(65 + i)}</span><b>{h}</b></div><span className="arrow">←</span><select value={mapping[h] || ''} onChange={e => setMapping({ ...mapping, [h]: e.target.value })}>{platformFields.map(field => <option key={field.value} value={field.value}>{field.label}</option>)}</select></div>)}<div className="card-footer"><button className="secondary" onClick={() => setStep(2)}>السابق</button><button className="primary" disabled={loading} onClick={save}>{loading ? 'جارٍ الحفظ...' : 'حفظ وتفعيل المزامنة'}</button></div></div>}
          {step === 4 && <div className="center-panel success"><div className="success-icon"><Check/></div><span className="success-label">تم التفعيل بنجاح</span><h2>المزامنة تعمل الآن</h2><p>سيتم فحص الصفوف الجديدة وإضافتها إلى قائمة العملاء المحتملين بشكل تلقائي.</p><div className="sync-info"><div><small>الملف المتصل</small><b>{file?.name}</b></div><div><small>الصفحة</small><b>{tab?.title}</b></div><div><small>حالة المزامنة</small><b className="green"><i/> نشطة</b></div></div><button className="primary">عرض العملاء المحتملين</button>{saved && <button className="text-btn" onClick={() => { setStep(3); setSaved(false); }}>تعديل مطابقة الحقول</button>}</div>}
        </div>
        <p className="privacy">باستمرارك، أنت توافق على <u>سياسة الخصوصية</u> و<u>شروط الاستخدام</u> الخاصة بمنصة راء.</p>
      </section>
    </main>
  </div>;
}
