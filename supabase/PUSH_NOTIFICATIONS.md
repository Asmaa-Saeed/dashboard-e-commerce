# التطبيق على الموبايل (PWA) وإشعارات الهاتف

## شو اللي انضاف

- **تطبيق على الموبايل:** اللوحة صار فيها تتنزّل على الموبايل باسم **Flowpal** وبأيقونة Flowpal، وبتفتح بشاشة كاملة.
  - Android: بيطلع زر «تثبيت التطبيق».
  - iPhone: بتطلع خطوات «إضافة إلى الشاشة الرئيسية».
- **إشعارات الهاتف:** بيوصل إشعار على الموبايل في حالتين، حتى لو التطبيق مسكّر:
  - **طلب جديد:** مثلًا «طلب جديد YH-…» وتحته «سماح · نابلس · 120.5 ₪».
  - **محادثة تحتاج إلى رد:** لما تصير حالة المحادثة `needs_human`، مثلًا «أم أحمد · طلب التحدث مع موظف · …».
  - لما الموظف يكبس على الإشعار، بيفتح صفحة الطلبات أو نفس المحادثة.
- **الصوت:** الإشعار بيرن بصوت الإشعارات تبع الموبايل، ومعه اهتزاز على Android. الويب ما بيسمح بنغمة خاصة. وإذا كانت اللوحة مفتوحة، النغمة اللي موجودة من قبل بتضل شغّالة.
- **كيف بيشتغل:**
  1. الموظف بيكبس «تفعيل الإشعارات» في اللوحة، من زر الجرس في الشريط العلوي أو من البطاقة اللي بتطلع فوق الصفحة.
  2. الموبايل بينحفظ في جدول `push_subscriptions`.
  3. لما ينضاف طلب أو محادثة بتحتاج موظف، الـ trigger بينادي Edge Function اسمها `send-push` عن طريق `pg_net`.
  4. الدالة بتبعت الإشعار لكل موبايلات المتجر.

## الملفات

| الملف | شو بيعمل |
|---|---|
| `supabase/05_push_notifications.sql` | جدول `push_subscriptions`، دوال الحفظ والإلغاء، والـ triggers على `orders` و`conversations` |
| `supabase/functions/send-push/` | الـ Edge Function اللي بتبعت الإشعارات |
| `public/sw.js` | الـ service worker: بيعرض الإشعار، وبيفتح الصفحة لما الموظف يكبس عليه، وبيعرض صفحة «لا يوجد اتصال» |
| `src/app/manifest.ts`، `public/icons/` | اسم التطبيق وأيقوناته |
| `src/components/pwa/` | زر التثبيت، وزر وبطاقة تفعيل الإشعارات |

> **أمان:** مفتاح الـ `service_role` بيضل جوا Supabase، والـ Edge Function بتاخده تلقائيًا. ما بينحط على Vercel ولا بأي مكان تاني.

---

## خطوات التشغيل (مرة وحدة)

### 1. مفاتيح الإشعارات (VAPID)

على أي جهاز عليه Node:

```bash
npx web-push generate-vapid-keys
```

بيطلعلك مفتاحين:

- **Public Key:** بينحط على Vercel وفي Supabase.
- **Private Key:** بينحط في Supabase بس، وما بينبعت بالشات.

### 2. Vercel

- روحي على Project → Settings → Environment Variables وضيفي:
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = الـ Public Key
  - فعّليه لـ Production وPreview.
- بعدها اعملي Redeploy. التغيير ما بيوصل للموقع قبل الـ redeploy.

### 3. قاعدة البيانات

من SQL Editor، شغّلي `05_push_notifications.sql` (بعد `04_bot.sql`). الملف بيفعّل `pg_net` لحاله، وفيكِ تشغّليه أكتر من مرة بدون مشاكل.

### 4. الـ Edge Function

**عن طريق الـ CLI (الأسهل):**

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase functions deploy send-push --no-verify-jwt
```

- `--no-verify-jwt` ضروري: الدالة بتستقبل النداء من قاعدة البيانات، وبتتحقق بالسر `x-push-secret` بدل الـ JWT.
- **من الـ Dashboard بدل الـ CLI:** Edge Functions → Deploy a new function → Via Editor، وسمّيها `send-push`.
  - الصقي محتوى `index.ts`.
  - بعد الـ deploy روحي على Settings تبع الدالة، وطفّي **Enforce JWT Verification**.

### 5. أسرار الدالة

روحي على Edge Functions → Secrets، أو استعملي `npx supabase secrets set`:

| الاسم | القيمة |
|---|---|
| `PUSH_WEBHOOK_SECRET` | نص عشوائي طويل. ولّديه بـ `select encode(gen_random_bytes(32), 'hex');` |
| `VAPID_PUBLIC_KEY` | الـ Public Key |
| `VAPID_PRIVATE_KEY` | الـ Private Key |
| `VAPID_SUBJECT` | `mailto:` وبعدها إيميل التواصل، مثلًا `mailto:support@flowpal.app` |

### 6. أسرار Vault (عشان قاعدة البيانات تعرف وين تبعت)

من SQL Editor، بنفس السر اللي في الخطوة 5:

```sql
select vault.create_secret('https://<PROJECT_REF>.supabase.co/functions/v1/send-push', 'push_function_url');
select vault.create_secret('<نفس PUSH_WEBHOOK_SECRET>', 'push_webhook_secret');
```

قبل ما تنعمل هالخطوة، الـ triggers ما بتعمل شي، والطلبات بتنحفظ عادي.

---

## التجربة

1. افتحي اللوحة من الموبايل ونزّليها كتطبيق.
   - على iPhone لازم Safari، و«إضافة إلى الشاشة الرئيسية»، وiOS 16.4 أو أحدث. بعدها افتحيها من الأيقونة.
2. سجّلي دخول، واكبسي «تفعيل الإشعارات»، ووافقي على الإذن.
3. سكّري التطبيق، واعملي طلب تجريبي من البوت، أو حوّلي محادثة لـ «تحتاج إلى رد».
4. لازم يوصل الإشعار خلال ثواني.

**إذا ما وصل الإشعار:**

- **هل الموبايل انحفظ؟** `select count(*) from push_subscriptions;`
- **هل قاعدة البيانات نادت الدالة؟** `select status_code, content from net._http_response order by created desc limit 5;`
  - `401`: السر في Vault مختلف عن `PUSH_WEBHOOK_SECRET`.
  - `200` مع `failed`: شوفي Logs تبع الدالة.
- **Logs:** Edge Functions → send-push → Logs.

## اختبارات قاعدة البيانات

`tests/60_push_notifications.sql` بيشتغل على Postgres محلي مع `tests/60_push_stub.sql` بدل `pg_net` والـ Vault. التفاصيل في `tests/README.md`.
