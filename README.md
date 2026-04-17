# WhatsApp Business SaaS Platform

A production-ready WhatsApp Business management platform built with **Next.js 14**, **MySQL**, and **Meta WhatsApp Cloud API** — similar to AiSensy.

---

## Features

| Feature | Description |
|---------|-------------|
| **Multi-tenant** | Each user gets their own workspace with separate API credentials |
| **Chat Inbox** | WhatsApp Web-style chat UI with real-time polling |
| **Bulk Campaigns** | Send template messages to thousands of contacts |
| **CRM Contacts** | Manage leads with tags, status, and CSV import |
| **Templates** | Create & submit templates for Meta approval |
| **Chatbot** | Rule-based auto-reply by keyword/pattern |
| **Analytics** | Delivery rates, read rates, conversion charts |
| **Webhook** | Receive messages & status updates from Meta in real-time |

---

## Project Structure

```
whatsapp-saas/
├── app/
│   ├── api/
│   │   ├── auth/        login, signup, logout
│   │   ├── webhook/     Meta webhook handler
│   │   ├── contacts/    CRUD + CSV import
│   │   ├── messages/    conversation history
│   │   ├── templates/   CRUD + Meta submission
│   │   ├── campaigns/   CRUD + launch (bulk send)
│   │   ├── chatbot/     CRUD rules
│   │   ├── analytics/   summary + chart data
│   │   └── workspace/   settings
│   ├── dashboard/       Analytics overview
│   ├── inbox/           Chat UI
│   ├── contacts/        CRM
│   ├── campaigns/       Bulk campaigns
│   ├── templates/       Template manager
│   ├── chatbot/         Chatbot rules
│   ├── analytics/       Full analytics
│   ├── settings/        Workspace config
│   ├── login/
│   └── signup/
├── lib/
│   ├── db.ts            MySQL connection pool
│   ├── auth.ts          JWT + bcrypt helpers
│   ├── whatsapp.ts      Meta API wrapper
│   └── utils.ts         Shared utilities
├── types/index.ts       TypeScript interfaces
├── middleware.ts        Auth route protection
├── schema.sql           MySQL schema
└── .env.local.example  Environment template
```

---

## Quick Start

### 1. Clone & Install

```bash
cd whatsapp
npm install
```

### 2. Setup MySQL Database

```bash
mysql -u root -p < schema.sql
```

### 3. Configure Environment

```bash
cp .env.local.example .env.local
# Edit .env.local with your MySQL credentials and Meta API keys
```

### 4. Get Meta API Credentials

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create App → Add **WhatsApp** product
3. Create/connect a WhatsApp Business Account
4. Copy **Phone Number ID** and **Access Token**
5. In WhatsApp → Configuration, add webhook URL:
   ```
   https://your-domain.com/api/webhook
   ```
6. Set verify token (copy from Settings page)
7. Subscribe to: `messages`, `message_deliveries`, `message_reads`

### 5. Run Locally

```bash
npm run dev
# Open http://localhost:3000
```

### 6. Signup & Configure

1. Go to `http://localhost:3000/signup`
2. Create your account
3. Go to **Settings** → paste your Meta credentials
4. Create a **Template** → wait for Meta approval
5. Import **Contacts** (CSV or manual)
6. Launch a **Campaign** 🚀

---

## API Reference

### Auth
```
POST /api/auth/signup    { name, email, password, workspaceName }
POST /api/auth/login     { email, password }
POST /api/auth/logout
```

### Messages
```
POST /api/send-message   { contactId, type, text } OR { contactId, type:'template', templateName, language, components }
GET  /api/messages?contactId=X&limit=50
```

### Contacts
```
GET  /api/contacts?page=1&limit=20&search=X&status=new
POST /api/contacts       { name, phone, email, city, source, tags, status }
PUT  /api/contacts/:id
DEL  /api/contacts/:id
POST /api/contacts/import  (multipart/form-data, file=CSV)
```

### Templates
```
GET  /api/templates
POST /api/templates      { name, language, category, body_text, ... }
```

### Campaigns
```
GET  /api/campaigns
POST /api/campaigns      { name, template_id, contact_ids, scheduled_at }
POST /api/campaigns/:id/launch
```

### Chatbot
```
GET  /api/chatbot
POST /api/chatbot        { trigger_type, trigger_value, response_type, response_text, priority }
PUT  /api/chatbot/:id
DEL  /api/chatbot/:id
```

### Analytics
```
GET  /api/analytics
```

### Webhook (Meta)
```
GET  /api/webhook?hub.mode=subscribe&hub.verify_token=X&hub.challenge=Y
POST /api/webhook   (receives messages and status updates)
```

---

## Sample cURL Requests

```bash
# Signup
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123","workspaceName":"My Business"}'

# Send message (use token from signup response)
curl -X POST http://localhost:3000/api/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"contactId":1,"type":"text","text":"Hello from API!"}'

# Import contacts CSV
curl -X POST http://localhost:3000/api/contacts/import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@contacts.csv"
```

### Sample contacts.csv
```csv
name,phone,email,city,source
John Doe,919876543210,john@example.com,Mumbai,website
Jane Smith,919123456789,jane@example.com,Delhi,manual
```

---

## Deployment

### Vercel (Recommended)

```bash
npm i -g vercel
vercel --prod
```

Set environment variables in Vercel dashboard.

### Self-hosted (VPS/EC2)

```bash
npm run build
npm start
# Or use PM2:
pm2 start npm --name "wa-saas" -- start
```

Use **PlanetScale**, **Railway**, or **AWS RDS** for MySQL in production.

---

## Meta WhatsApp API Rules

- Only send **template messages** to users who haven't messaged you in 24h
- Free-form messages allowed within 24h of user's last message
- Respect opt-in requirements — only message users who consented
- Template message rate limit: ~80/second per phone number

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, TypeScript, Recharts
- **Backend**: Next.js API Routes (Node.js)
- **Database**: MySQL 8+ with mysql2
- **Auth**: JWT + bcrypt
- **WhatsApp**: Meta Cloud API v19.0

---

Built with ❤️ using Next.js + Meta WhatsApp Cloud API
