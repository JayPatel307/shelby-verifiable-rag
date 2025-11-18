# 🔐 Quick Setup: Get Google OAuth Credentials (5 Minutes)

---

## 🎯 What You Need to Do NOW

### 1. Go to Google Cloud Console
👉 https://console.cloud.google.com/apis/credentials

### 2. Create OAuth Client ID
1. Click "**Create Credentials**" → "**OAuth client ID**"
2. If prompted, configure consent screen first (see below)
3. Application type: **Web application**
4. Name: `Shelby RAG`
5. **Authorized redirect URIs** (important!):
   ```
   http://localhost:3000/api/auth/callback/google
   ```
6. Click **Create**

### 3. Copy Credentials
You'll see:
```
Client ID: 123456789-abc.apps.googleusercontent.com
Client Secret: GOCSPX-xxxxxxx
```

### 4. Update Your .env.local
```bash
cd /Users/jay/src/shelby-verifiable-rag/apps/web

# Edit .env.local and add:
cat >> .env.local << 'EOF'

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32 | tr -d '\n')

# Google OAuth - PASTE YOUR VALUES HERE
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret-here
EOF
```

Or manually edit and add your credentials.

### 5. Restart Web Server
```bash
pkill -f "next dev"
pnpm dev:web
```

### 6. Test!
1. Go to http://localhost:3000
2. Click "Login"
3. Click "Continue with Google"
4. Sign in!

---

## 🆘 If Consent Screen Not Configured

### Configure OAuth Consent Screen:
1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Choose: **External**
3. Fill in:
   - App name: `Shelby RAG`
   - User support email: your@gmail.com
   - Developer contact: your@gmail.com
4. Scopes: Add `userinfo.email` and `userinfo.profile`
5. Test users: Add your Gmail
6. Save

---

## ✅ That's It!

Once you add the credentials, you'll have:
- ✅ Professional Google sign-in
- ✅ Secure authentication
- ✅ User email and profile
- ✅ Production-ready auth

See **GOOGLE_OAUTH_SETUP.md** for detailed instructions.

---

**Get your credentials and update .env.local, then test the login!** 🚀

