# تكامل راء مع Google Sheets

واجهة عربية متكاملة لربط ملفات Google Sheets، اختيار الصفحة، قراءة العناوين، مطابقة الحقول، ثم مزامنة الصفوف الجديدة إلى Supabase كل خمس دقائق.

## التشغيل المحلي

```bash
npm install
cp .env.example .env
npm run dev
```

افتح الرابط الذي يطبعه Vite في الطرفية (عادةً `http://localhost:5173`). إذا أردت
فتح المعاينة من جهاز آخر على الشبكة نفسها، استخدم عنوان الشبكة الذي يظهر بجانب
`Network` لأن أمر التشغيل يستمع إلى جميع الواجهات.

يمكن تجربة رحلة الربط كاملة دون إعداد Google: اترك `VITE_GOOGLE_CLIENT_ID` فارغاً،
واضغط **المتابعة باستخدام Google** لتشغيل وضع العرض التجريبي. أما لاختبار Google
الحقيقي، فانسخ `.env.example` إلى `.env` واملأ القيم الثلاث قبل تشغيل الخادم.

لمعاينة نسخة الإنتاج محلياً:

```bash
npm run build
npm run preview
```

ثم افتح `http://localhost:4173`. يفتح المسار الرئيسي المعاينة التفاعلية مباشرة،
ولا يحتاج أمر `preview` إلى تثبيت حزم npm. ولإيقاف الخادم اضغط `Ctrl+C` في الطرفية.

يمكن أيضاً تشغيل النسخة التفاعلية المستقلة بالأمر البديل:

```bash
npm run dev:preview
```

ثم افتح `http://localhost:4173/preview.html`. هذه النسخة مخصصة لتجربة الشاشات
والتنقل فقط ولا تتصل بحساب Google أو Supabase الحقيقي.

## رابط معاينة عام

يتضمن المستودع Workflow باسم **Deploy interactive preview** ينشر المعاينة الثابتة
إلى GitHub Pages دون npm أو مفاتيح سرية. بعد دفع الفرع إلى GitHub:

1. افتح **Settings → Pages** واختر **GitHub Actions** كمصدر النشر.
2. افتح **Actions → Deploy interactive preview → Run workflow**.
3. يظهر الرابط العام في خانة `github-pages` داخل نتيجة الـ workflow، ويكون عادةً
   `https://<owner>.github.io/<repository>/`.

جميع أصول صفحة المعاينة تستخدم مسارات نسبية، لذلك تعمل التنسيقات أيضاً عندما
يُنشر الموقع داخل مسار مستودع GitHub Pages وليس على جذر النطاق.

لا يحتوي هذا الرابط على Google أو Supabase credentials؛ فهو مخصص لتجربة واجهة
المستخدم فقط. يلزم نشر التطبيق الفعلي وإضافة نطاقه إلى Google OAuth لاختبار الربط
الحقيقي.

أنشئ OAuth Client من Google Cloud، وفعّل Google Drive API وGoogle Sheets API، ثم أضف النطاق المحلي ونطاق الإنتاج إلى **Authorized JavaScript origins**. عند غياب `VITE_GOOGLE_CLIENT_ID` تعمل الواجهة في وضع العرض التجريبي لتسهيل المعاينة.

## إعداد Supabase

1. تأكد من وجود جدول `leads` واحتوائه على `user_id` وحقول المطابقة (`full_name`, `phone`, `email`, `service`, `doctor`, `source`, `notes`).
2. طبّق الملف `supabase/migrations/20260908000000_google_sheets_sync.sql`.
3. انشر الدالتين `google-sheets-connect` و`google-sheets-sync`.
4. أضف `TOKEN_ENCRYPTION_KEY` (مفتاح AES بطول 32 بايت ومشفّر Base64) إلى أسرار Edge Functions.
5. عيّن إعدادات قاعدة البيانات `app.settings.supabase_url` و`app.settings.service_role_key` كي يستطيع `pg_cron` استدعاء المزامنة.

> Google access tokens قصيرة العمر. للاستخدام الإنتاجي طويل الأجل، استخدم Authorization Code Flow في خادم موثوق وخزّن refresh token مشفراً، ثم جدّد access token داخل دالة المزامنة. الحالة الحالية تحوّل الاتصال إلى `reconnect_required` بأمان عند انتهاء الرمز بدلاً من الفشل الصامت.
