# Google Sheets Reader

واجهة عربية مستقلة لتسجيل الدخول باستخدام Google، وعرض ملفات Google Sheets التي يملكها الحساب، واختيار الصفحة وقراءة بياناتها مباشرة دون تخزينها.

## التشغيل المحلي

```bash
npm install
cp .env.example .env
npm run dev
```

افتح الرابط الذي يطبعه Vite في الطرفية (عادةً `http://localhost:5173`). إذا أردت
فتح المعاينة من جهاز آخر على الشبكة نفسها، استخدم عنوان الشبكة الذي يظهر بجانب
`Network` لأن أمر التشغيل يستمع إلى جميع الواجهات.

لا يوجد Demo Mode أو بيانات افتراضية. ضع `VITE_GOOGLE_CLIENT_ID` في `.env` ثم
سجّل الدخول بحساب Google الحقيقي. يستخدم التطبيق صلاحيات القراءة فقط.

لمعاينة نسخة الإنتاج محلياً:

```bash
npm run build
npm run preview
```

ثم افتح `http://localhost:4173`. يفتح المسار الرئيسي المعاينة التفاعلية مباشرة،
ولا يحتاج أمر `preview` إلى تثبيت حزم npm. ولإيقاف الخادم اضغط `Ctrl+C` في الطرفية.

## رابط معاينة عام

يتضمن المستودع Workflow باسم **Deploy interactive preview** ينشر المعاينة الثابتة
إلى GitHub Pages. أضف `VITE_GOOGLE_CLIENT_ID` في **Settings → Secrets and variables
→ Actions → Variables** ثم ادفع الفرع إلى GitHub:

1. افتح **Settings → Pages** واختر **GitHub Actions** كمصدر النشر.
2. افتح **Actions → Deploy interactive preview → Run workflow**.
3. يظهر الرابط العام في خانة `github-pages` داخل نتيجة الـ workflow، ويكون عادةً
   `https://<owner>.github.io/<repository>/`.

جميع أصول صفحة المعاينة تستخدم مسارات نسبية، لذلك تعمل التنسيقات أيضاً عندما
يُنشر الموقع داخل مسار مستودع GitHub Pages وليس على جذر النطاق.

أنشئ OAuth Web Client من نوع **Web application** في Google Cloud، ثم فعّل Google
Drive API وGoogle Sheets API. أضف نطاق التشغيل المحلي ورابط GitHub Pages إلى
**Authorized JavaScript origins**، مثل:

```text
http://localhost:5173
https://<owner>.github.io
```

يطلب التطبيق `drive.metadata.readonly` لعرض أسماء الملفات و`spreadsheets.readonly`
لقراءة الشيت المختار. كما يقيّد استعلام Drive بالملفات التي يملكها الحساب الحالي.
