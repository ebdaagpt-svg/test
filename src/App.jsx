import { useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, FileSpreadsheet, LogOut, RefreshCw, Search, ShieldCheck, Table2, X } from 'lucide-react';
import { connectGoogle, hasGoogleConfig, listSpreadsheets, listTabs, readSheet } from './googleSheets';

export function App() {
  const [mode, setMode] = useState(null);
  const [token, setToken] = useState(null);
  const [files, setFiles] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [file, setFile] = useState(null);
  const [tab, setTab] = useState(null);
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const headers = rows[0] ?? [];
  const dataRows = rows.slice(1);
  const filteredRows = useMemo(() => !query.trim() ? dataRows : dataRows.filter(row => row.some(cell => String(cell ?? '').toLowerCase().includes(query.trim().toLowerCase()))), [dataRows, query]);

  async function run(task) {
    setLoading(true); setError('');
    try { await task(); } catch (e) { setError(e.message || 'حدث خطأ غير متوقع'); }
    finally { setLoading(false); }
  }

  const login = async () => {
    setLoading(true); setError('');
    try {
      const connection = await connectGoogle();
      setMode(connection.mode); setToken(connection.token);
      setFiles(await listSpreadsheets(connection.mode, connection.token));
    } catch {
      setMode('mock'); setToken(null);
      setFiles(await listSpreadsheets('mock', null));
    } finally { setLoading(false); }
  };

  const chooseFile = selected => run(async () => {
    setFile(selected); setTab(null); setRows([]); setQuery('');
    setTabs(await listTabs(mode, token, selected.id));
  });

  const chooseTab = selected => run(async () => {
    setTab(selected); setQuery('');
    setRows(await readSheet(mode, token, file.id, selected.title));
  });

  const reset = () => { setMode(null); setToken(null); setFiles([]); setTabs([]); setFile(null); setTab(null); setRows([]); setQuery(''); setError(''); };
  const refresh = () => tab && run(async () => setRows(await readSheet(mode, token, file.id, tab.title)));

  if (!mode) return <main className="welcome-shell">
    <section className="welcome-card">
      <div className="logo-mark"><FileSpreadsheet /></div>
      <span className="eyebrow">Google Sheets Reader</span>
      <h1>استعرض جداولك<br />بوضوح وبساطة</h1>
      <p>سجّل الدخول بحساب Google واختر أي ملف لعرض صفوفه وأعمدته مباشرة، دون رفع البيانات أو تخزينها.</p>
      <button className="google-btn" onClick={login} disabled={loading}><span className="google-g">G</span>{loading ? 'جارٍ فتح الملفات...' : 'المتابعة باستخدام Google'}</button>
      {!hasGoogleConfig && <div className="demo-note"><span>وضع المعاينة</span> سيتم فتح ملف تجريبي تلقائياً لأن مفاتيح Google غير متاحة.</div>}
      <div className="trust-row"><ShieldCheck /><span><b>قراءة فقط</b><small>لا نعدّل ملفاتك ولا نخزن بياناتها.</small></span></div>
    </section>
  </main>;

  return <div className="viewer-shell" dir="rtl">
    <header className="viewer-header">
      <div className="viewer-brand"><span><FileSpreadsheet /></span><div><b>Sheets Reader</b><small>قارئ جداول Google</small></div></div>
      <div className="header-status"><span className={mode === 'mock' ? 'mock-badge' : 'live-badge'}>{mode === 'mock' ? 'معاينة تجريبية' : 'متصل بـ Google'}</span><button className="logout-btn" onClick={reset}><LogOut /> خروج</button></div>
    </header>
    <main className="workspace">
      <aside className="file-panel">
        <div className="panel-title"><div><h2>ملفاتي</h2><span>{files.length} ملف</span></div></div>
        <div className="file-search"><Search /><input placeholder="ابحث عن ملف..." /></div>
        <div className="files">{files.map(item => <button key={item.id} className={file?.id === item.id ? 'active' : ''} onClick={() => chooseFile(item)}><FileSpreadsheet /><span><b>{item.name}</b><small>عُدّل {new Date(item.modifiedTime).toLocaleDateString('ar-EG')}</small></span>{file?.id === item.id && <Check />}</button>)}</div>
      </aside>
      <section className="data-panel">
        {!file && <div className="empty-state"><div><Table2 /></div><h2>اختر ملفاً للبدء</h2><p>ستظهر صفحات الملف وبياناته هنا مباشرة.</p></div>}
        {file && <>
          <div className="data-toolbar">
            <div className="file-heading"><button className="back-mobile"><ArrowRight /></button><div><small>الملف المحدد</small><h2>{file.name}</h2></div></div>
            <div className="toolbar-actions"><label><span>الصفحة</span><select value={tab?.sheetId ?? ''} onChange={e => { const selected = tabs.find(item => String(item.sheetId) === e.target.value); if (selected) chooseTab(selected); }}><option value="">اختر الصفحة</option>{tabs.map(item => <option key={item.sheetId} value={item.sheetId}>{item.title}</option>)}</select><ChevronDown /></label><button className="refresh-btn" onClick={refresh} disabled={!tab || loading}><RefreshCw /> تحديث</button></div>
          </div>
          {error && <div className="error inline"><X />{error}</div>}
          {!tab && <div className="empty-state compact"><div><FileSpreadsheet /></div><h2>اختر صفحة من الملف</h2><p>يمكنك التنقل بين الصفحات من القائمة أعلاه.</p></div>}
          {tab && loading && !rows.length && <div className="loading-state"><RefreshCw /> جارٍ قراءة البيانات...</div>}
          {tab && !loading && !rows.length && <div className="empty-state compact"><div><Table2 /></div><h2>هذه الصفحة فارغة</h2><p>لم نعثر على صفوف قابلة للعرض.</p></div>}
          {rows.length > 0 && <div className="table-area">
            <div className="table-meta"><div><b>{tab.title}</b><span>{filteredRows.length} صف · {headers.length} عمود</span></div><label><Search /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث داخل البيانات..." /></label></div>
            <div className="table-scroll"><table><thead><tr><th className="row-number">#</th>{headers.map((header, index) => <th key={`${header}-${index}`}>{header || `العمود ${index + 1}`}</th>)}</tr></thead><tbody>{filteredRows.map((row, rowIndex) => <tr key={rowIndex}><td className="row-number">{rowIndex + 2}</td>{headers.map((_, cellIndex) => <td key={cellIndex}>{row[cellIndex] ?? <span className="empty-cell">—</span>}</td>)}</tr>)}</tbody></table></div>
          </div>}
        </>}
      </section>
    </main>
  </div>;
}
