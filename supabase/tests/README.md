# اختبارات قاعدة البيانات

بتشتغل على Postgres محلي (مش على Supabase الحقيقي). `00_local_auth_stub.sql` بيقلّد جزء Auth بتاع Supabase.

```bash
createdb t
psql -d t -f 00_local_auth_stub.sql
psql -d t -f ../01_setup.sql -f ../02_security_and_logic.sql -f 05_seed_test_emails.sql
psql -d t -f 10_access_and_stock.sql   # كل سطر فيه (expect error) لازم يطلع ERROR
psql -d t -f 20_status_and_team.sql
psql -d t -f 30_column_guards.sql

# دوال البوت: بعد ../03_seed_yasmeen.sql و ../04_bot.sql
psql -d t -c "alter role n8n_bot with password 'test-pass-123'"
PGPASSWORD=test-pass-123 psql -h 127.0.0.1 -U n8n_bot -d t -f 40_bot_functions.sql

# رد الفريق من اللوحة (كـ postgres)
psql -d t -f 50_staff_reply.sql
```

عدد الـ ERROR المتوقع: 8 ثم 2 ثم 7 ثم 7 ثم 2، وكلها رفض مقصود.
