# WhatsApp DB Connection Fix - TODO

## Plan Steps:
- [x] 1. Create DB test endpoint (`app/api/db/test/route.ts`) to check connection/env.
- [x] 2. User tests `/api/db/test`, shares result. **Result: "connect ETIMEDOUT"**
- [3 ] 3. Guide .env.local setup for local MySQL (DB_HOST=localhost, etc.).
- [ ] 4. Import schema.sql: `mysql -u root -p whatsapp_saas < schema.sql`
- [ ] 5. Seed test user.
- [ ] 6. Test login.
- [ ] 7. Remove test endpoint if successful.

**Current: Step 1**
