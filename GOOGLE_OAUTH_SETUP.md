# 🔐 Google OAuth Setup Guide

Complete guide to set up Google OAuth for production authentication.

---

## 🎯 Why Google OAuth?

✅ **Secure** - No password management needed  
✅ **User-friendly** - One-click sign in  
✅ **Trusted** - Users recognize Google  
✅ **Professional** - Production-ready  
✅ **Free** - No OAuth costs

---

## 📋 Prerequisites

- [ ] Google account
- [ ] GCP project (you already have this!)
- [ ] 10 minutes

---

## 🚀 Step-by-Step Setup

### Step 1: Go to Google Cloud Console (2 minutes)

1. Open: https://console.cloud.google.com
2. Select your GCP project (or create new one)
3. Enable APIs:
   - Go to "APIs & Services" → "Enable APIs and Services"
   - Search for "Google+ API" → Enable
   - (This allows accessing user profile info)

### Step 2: Create OAuth Consent Screen (3 minutes)

1. Go to: **APIs & Services** → **OAuth consent screen**

2. Choose user type:
   - **External** (for public access)
   - Click "Create"

3. Fill in App Information:
   ```
   App name: Shelby Verifiable RAG
   User support email: your-email@gmail.com
   App logo: (optional - can add Shelby logo)
   ```

4. Add Authorized domains:
   ```
   localhost (for development)
   vercel.app (for Vercel deployments)
   your-domain.com (if you have custom domain)
   ```

5. Developer contact:
   ```
   your-email@gmail.com
   ```

6. Scopes:
   - Click "Add or Remove Scopes"
   - Add:
     - `userinfo.email`
     - `userinfo.profile`
   - Click "Update"

7. Test users (for development):
   - Add your Gmail address
   - Add teammate emails
   - Click "Save and Continue"

8. Review and go back to dashboard

### Step 3: Create OAuth Credentials (3 minutes)

1. Go to: **APIs & Services** → **Credentials**

2. Click "**Create Credentials**" → **OAuth client ID**

3. Application type: **Web application**

4. Name: `Shelby RAG Web App`

5. Authorized JavaScript origins:
   ```
   http://localhost:3000
   https://your-app.vercel.app
   ```

6. Authorized redirect URIs:
   ```
   http://localhost:3000/api/auth/callback/google
   https://your-app.vercel.app/api/auth/callback/google
   ```

7. Click "**Create**"

8. **IMPORTANT**: Copy these values:
   ```
   Client ID: xxx.apps.googleusercontent.com
   Client Secret: GOCSPX-xxx
   ```

### Step 4: Configure Your App (2 minutes)

#### For Local Development:

```bash
cd /Users/jay/src/shelby-verifiable-rag/apps/web

# Create .env.local (if not exists)
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:4000

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
EOF
```

#### For Production (Vercel):

Go to Vercel Dashboard → Your Project → Settings → Environment Variables

Add:
```
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=generated_secret_from_above
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## 🧪 Test It!

### Step 1: Install dependencies
```bash
cd /Users/jay/src/shelby-verifiable-rag
pnpm install
```

### Step 2: Restart servers
```bash
# Kill old processes
pkill -f "tsx watch|next dev"

# Start API
pnpm dev:api

# Start Web (in another terminal)
pnpm dev:web
```

### Step 3: Test Login
1. Go to http://localhost:3000
2. Click "Login"
3. Click "Continue with Google"
4. Sign in with your Google account
5. You should be redirected to /packs

### Step 4: Verify
- Check navigation shows your email
- Try creating a pack
- Try querying
- Click logout → should sign you out

---

## 🔒 Security Best Practices

### Do's:
✅ Keep Client Secret in environment variables  
✅ Never commit secrets to Git  
✅ Use HTTPS in production  
✅ Set proper authorized domains  
✅ Rotate secrets periodically  

### Don'ts:
❌ Don't expose Client Secret in frontend  
❌ Don't hardcode credentials  
❌ Don't skip consent screen  
❌ Don't allow all domains  

---

## 🐛 Troubleshooting

### "Redirect URI mismatch"
**Fix**: Add exact URL to authorized redirect URIs in Google Console

### "Access blocked: This app's request is invalid"
**Fix**: Complete OAuth consent screen configuration

### "Invalid client"
**Fix**: Check Client ID and Secret are correct

### Sign in button does nothing
**Fix**: 
1. Check browser console for errors
2. Verify NEXTAUTH_URL matches current URL
3. Check API is running

### User created but can't access packs
**Fix**: Check x-user-id header is being sent to API

---

## 📝 Quick Reference

### Environment Variables:
```env
# Web (.env.local)
NEXTAUTH_URL=http://localhost:3000 (or production URL)
NEXTAUTH_SECRET=random_string_32_chars
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
```

### Google Console URLs:
- **OAuth Consent**: https://console.cloud.google.com/apis/credentials/consent
- **Credentials**: https://console.cloud.google.com/apis/credentials
- **Enabled APIs**: https://console.cloud.google.com/apis/dashboard

### NextAuth URLs:
- **Sign In**: http://localhost:3000/api/auth/signin
- **Sign Out**: http://localhost:3000/api/auth/signout
- **Session**: http://localhost:3000/api/auth/session

---

## ✅ Checklist

Before going live:
- [ ] OAuth consent screen configured
- [ ] Credentials created
- [ ] Redirect URIs added (dev + prod)
- [ ] Environment variables set
- [ ] Tested login flow
- [ ] Tested logout
- [ ] Tested creating packs
- [ ] Verified user_id is passed to API

---

## 🎉 Done!

You now have professional Google OAuth authentication!

**Next**: Ready to deploy with proper authentication? 🚀

