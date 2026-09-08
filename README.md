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

ثم افتح `http://localhost:4173`. ولإيقاف أي من خادمي المعاينة اضغط `Ctrl+C` في
الطرفية.

أنشئ OAuth Client من Google Cloud، وفعّل Google Drive API وGoogle Sheets API، ثم أضف النطاق المحلي ونطاق الإنتاج إلى **Authorized JavaScript origins**. عند غياب `VITE_GOOGLE_CLIENT_ID` تعمل الواجهة في وضع العرض التجريبي لتسهيل المعاينة.

## إعداد Supabase

1. تأكد من وجود جدول `leads` واحتوائه على `user_id` وحقول المطابقة (`full_name`, `phone`, `email`, `service`, `doctor`, `source`, `notes`).
2. طبّق الملف `supabase/migrations/20260908000000_google_sheets_sync.sql`.
3. انشر الدالتين `google-sheets-connect` و`google-sheets-sync`.
4. أضف `TOKEN_ENCRYPTION_KEY` (مفتاح AES بطول 32 بايت ومشفّر Base64) إلى أسرار Edge Functions.
5. عيّن إعدادات قاعدة البيانات `app.settings.supabase_url` و`app.settings.service_role_key` كي يستطيع `pg_cron` استدعاء المزامنة.

> Google access tokens قصيرة العمر. للاستخدام الإنتاجي طويل الأجل، استخدم Authorization Code Flow في خادم موثوق وخزّن refresh token مشفراً، ثم جدّد access token داخل دالة المزامنة. الحالة الحالية تحوّل الاتصال إلى `reconnect_required` بأمان عند انتهاء الرمز بدلاً من الفشل الصامت.
