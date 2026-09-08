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

لا يوجد Demo Mode أو بيانات Google افتراضية. يجب أن يكون المستخدم مسجلاً في راء،
وأن تكون مفاتيح Supabase في `.env`، ثم يتم التفويض من حساب Google الحقيقي فقط.

لمعاينة نسخة الإنتاج محلياً:

```bash
npm run build
npm run preview
```

ثم افتح `http://localhost:4173`. يفتح المسار الرئيسي المعاينة التفاعلية مباشرة،
ولا يحتاج أمر `preview` إلى تثبيت حزم npm. ولإيقاف الخادم اضغط `Ctrl+C` في الطرفية.

## رابط معاينة عام

يتضمن المستودع Workflow باسم **Deploy interactive preview** ينشر المعاينة الثابتة
إلى GitHub Pages دون npm أو مفاتيح سرية. بعد دفع الفرع إلى GitHub:

1. افتح **Settings → Pages** واختر **GitHub Actions** كمصدر النشر.
2. افتح **Actions → Deploy interactive preview → Run workflow**.
3. يظهر الرابط العام في خانة `github-pages` داخل نتيجة الـ workflow، ويكون عادةً
   `https://<owner>.github.io/<repository>/`.

جميع أصول صفحة المعاينة تستخدم مسارات نسبية، لذلك تعمل التنسيقات أيضاً عندما
يُنشر الموقع داخل مسار مستودع GitHub Pages وليس على جذر النطاق.

أنشئ OAuth Web Client من Google Cloud وفعّل Google Drive API وGoogle Sheets API.
أضف رابط callback التالي إلى **Authorized redirect URIs**:

```text
https://YOUR_PROJECT.supabase.co/functions/v1/google-sheets-connect
```

## إعداد Supabase

1. تأكد من وجود جدول `leads` واحتوائه على `user_id` وحقول المطابقة (`full_name`, `phone`, `email`, `service`, `doctor`, `source`, `notes`).
2. طبّق الملف `supabase/migrations/20260908000000_google_sheets_sync.sql`.
3. انشر الدالتين `google-sheets-connect` و`google-sheets-sync`؛ ملف `supabase/config.toml` يعطّل فحص JWT الافتراضي لأن callback من Google لا يحمل JWT، بينما تتحقق الدالة نفسها من جلسة المستخدم لكل طلب داخلي.
4. أضف أسرار Edge Functions: `GOOGLE_CLIENT_ID` و`GOOGLE_CLIENT_SECRET` و`TOKEN_ENCRYPTION_KEY` و`APP_ALLOWED_ORIGINS` و`SYNC_CRON_SECRET`.
5. يجب أن يكون `TOKEN_ENCRYPTION_KEY` مفتاح AES عشوائياً بطول 32 بايت ومشفراً Base64، و`APP_ALLOWED_ORIGINS` قائمة نطاقات الواجهة المسموح بها مفصولة بفواصل.
6. أنشئ في Supabase Vault سرّين باسم `project_url` و`sync_cron_secret`. يجب أن تطابق قيمة `sync_cron_secret` سر Edge Function نفسه.

يستخدم الربط Authorization Code Flow على الخادم، ويحفظ Refresh Token مشفراً،
ويجدّد Access Token تلقائياً دون كشف أي من الرمزين للمتصفح.
