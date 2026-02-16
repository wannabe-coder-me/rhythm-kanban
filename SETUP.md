# Rhythm Kanban - Setup Guide

## Railway Deployment

### 1. Create Railway Project

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click "New Project" → "Deploy from GitHub Repo"
3. Select `wannabe-coder-me/rhythm-kanban`
4. Railway will auto-detect Next.js

### 2. Add PostgreSQL Database

1. In your Railway project, click "+ New"
2. Select "Database" → "Add PostgreSQL"
3. Railway will auto-provision the database
4. The `DATABASE_URL` will be automatically available

### 3. Environment Variables

Add these variables in Railway (Settings → Variables):

```
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=https://<your-railway-domain>.railway.app
GOOGLE_CLIENT_ID=666652868511-gfhht8titf648mbeo35hv03hgunub895.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<get from Google Cloud Console>
```

### 4. Google OAuth Setup

If you need to configure Google OAuth:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to APIs & Services → Credentials
4. Create OAuth 2.0 Client ID (Web application)
5. Add authorized redirect URIs:
   - `https://<your-railway-domain>.railway.app/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (for local dev)
6. Copy Client ID and Client Secret to Railway variables

### 5. Deploy

Railway auto-deploys on push to `main`. After setting variables:
1. Railway will rebuild automatically
2. Database schema pushes via `prisma db push` during build
3. App will be live at your Railway domain

## Local Development

```bash
# Copy env example
cp .env.example .env

# Fill in .env with your values
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Push database schema
npx prisma db push

# Start dev server
npm run dev
```

## Custom Domain (Optional)

1. In Railway project Settings → Domains
2. Add custom domain (e.g., `kanban.rhythm.engineering`)
3. Update DNS records as instructed
4. Update `NEXTAUTH_URL` to match custom domain
