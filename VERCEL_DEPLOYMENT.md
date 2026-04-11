# Vercel Deployment Guide: Dynamic API Configuration

## Overview

Your application now uses dynamic API URL configuration instead of hardcoded `http://localhost` URLs. This enables seamless deployment to Vercel with different API endpoints per environment.

## Architecture

The configuration system works through a priority chain in `config.js`:

```
1. Window variable (window.__APP_CONFIG__.API_BASE_URL)
2. Vite environment variable (import.meta.env.VITE_API_URL)
3. localStorage override (for development/testing)
4. Auto-detection based on current hostname
5. Hardcoded fallback (http://localhost:3000/api)
```

## Local Development

### Option A: Auto-Detection (Recommended for Localhost)

No configuration needed! The system automatically detects `localhost` and uses `http://localhost:3000/api`.

```bash
npm run dev  # or your local development command
# API will be: http://localhost:3000/api
```

### Option B: Explicit Configuration via .env.local

If using a bundler (Vite, Webpack, etc.):

```bash
# .env.local
VITE_API_URL=http://localhost:3000/api
```

### Option C: Runtime Override via localStorage

In browser console:
```javascript
localStorage.setItem('app_api_base_url', 'http://localhost:3000/api');
location.reload();
```

## Vercel Deployment (Production)

### Step 1: Set Environment Variables in Vercel Dashboard

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add the following:

```
VITE_API_URL=https://your-backend-api.com/api
```

For **production**:
```
Name:  VITE_API_URL
Value: https://your-backend-api.com/api
```

For **preview/staging**:
```
Name:  VITE_API_URL
Value: https://staging-api.your-backend.com/api
(Set Environments: Preview)
```

### Step 2: Deployment Trigger

When you deploy to Vercel:
- Vercel will read `VITE_API_URL` from environment variables
- If your build process supports it, it will be injected into the app
- If not, the auto-detection fallback will handle same-domain requests

### Step 3: Verify Deployment

After deployment, check in browser console:
```javascript
Config.logConfig();  // Shows current API base URL
```

Should output something like:
```
[Config] Current API Base URL: https://your-domain.vercel.app/api
[Config] Hostname: your-domain.vercel.app
[Config] Protocol: https:
```

## Common Scenarios

### Scenario 1: Frontend on Vercel + Backend Same Domain

**Setup:**
- Frontend: `https://myapp.vercel.app`
- Backend: `https://myapp.vercel.app/api`

**Configuration:**
- No environment variable needed!
- Auto-detection sees same hostname and uses: `https://myapp.vercel.app/api`

### Scenario 2: Frontend on Vercel + Backend on Separate Domain

**Setup:**
- Frontend: `https://myapp.vercel.app`
- Backend: `https://api.mycompany.com/api`

**Configuration:**
```
VITE_API_URL=https://api.mycompany.com/api
```

### Scenario 3: Multiple Environments (Dev, Staging, Production)

**Vercel Environment Variables:**

1. **Production**
   ```
   VITE_API_URL=https://api.mycompany.com (for production branch)
   ```

2. **Preview/Staging**
   ```
   VITE_API_URL=https://staging-api.mycompany.com (for non-production branches)
   ```

3. **Local Development**
   ```
   # .env.local
   VITE_API_URL=http://localhost:3000/api
   ```

### Scenario 4: CORS Issues with Separate Backend

If you're getting CORS errors, ensure your backend (Express) has CORS properly configured:

```javascript
// backend/server.js
const cors = require("cors");
app.use(cors({
  origin: [
    "http://localhost:5500",      // Local dev
    "http://localhost:3000",      // Vite dev server
    "https://myapp.vercel.app",   // Production
    "https://*.vercel.app"        // Preview deployments
  ],
  credentials: true
}));
```

## Debugging

### Check Current Configuration

In browser console:
```javascript
// See what API URL is being used
Config.logConfig();

// Manually override for testing
Config.setApiBaseUrl('https://test-api.com/api');

// Clear override
Config.clearApiBaseUrl();
```

### Monitor API Calls

Open browser DevTools (F12) → Network tab and look for:
- ✅ Requests to `https://api.mycompany.com/...` (correct)
- ❌ Requests to `http://127.0.0.1:5500/...` (wrong - static server)
- ❌ Requests to `http://localhost:5500/...` (wrong - wrong port)

### Check Environment Variable Injection

```javascript
// If using Vite:
console.log(import.meta.env.VITE_API_URL);

// If using window variable:
console.log(window.__APP_CONFIG__?.API_BASE_URL);
```

## Code Changes Summary

### Files Modified

1. **config.js** (NEW) - Dynamic environment configuration module
2. **api.js** - Changed from hardcoded `API_BASE_URL` to `Config.getApiUrl()`
3. **case-detail.js** - ERV endpoint uses dynamic API URL
4. **.env.local** (NEW) - Local development configuration
5. **All HTML files** - Added `<script src="config.js"></script>` before api.js loading

### Before (Hardcoded)
```javascript
const API_BASE_URL = "http://localhost:3000/api";
const response = await fetch("http://localhost:3000/api/cases/4/erv-transmit");
```

### After (Dynamic)
```javascript
const apiBaseUrl = Config.getApiBaseUrl();
const response = await fetch(`${apiBaseUrl}/cases/4/erv-transmit`);
```

## Rollback (If Needed)

If you need to revert to hardcoded URLs:

1. Edit `api.js`:
   ```javascript
   const API_BASE_URL = "http://localhost:3000/api";
   function getApiUrl(path) {
     return `${API_BASE_URL}${path}`;
   }
   ```

2. Remove `<script src="config.js"></script>` from HTML files

3. Delete `config.js` and `.env.local`

## Support & Troubleshooting

### Error: "Failed to Fetch" in Production

**Cause**: API URL pointing to wrong domain

**Solution**:
1. Check Vercel Environment Variables (Settings → Environment Variables)
2. Verify `VITE_API_URL` is set correctly
3. Check CORS headers in backend allow Vercel domain

### Error: "API is undefined" or "Config is not defined"

**Cause**: Scripts not loading in correct order

**Solution**:
1. Verify `config.js` is loaded BEFORE `api.js` in HTML
2. Check browser console for 404 errors on script loads
3. Ensure `.js` files are in the root directory

### Error: 403 Forbidden on API Calls

**Cause**: CORS or authentication issues

**Solution**:
1. Check CORS configuration in backend
2. Verify JWT token is being sent in Authorization header
3. Check browser DevTools → Network → Request Headers

### API Works Locally but Not on Vercel

**Checklist**:
- [ ] Environment variable `VITE_API_URL` is set in Vercel Dashboard
- [ ] Backend CORS allows Vercel domain
- [ ] Backend is actually accessible from internet (test with curl/Postman)
- [ ] SSL certificate is valid (https not http)
- [ ] DNS records point to correct backend server

## Additional Resources

- [Vercel Environment Variables Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vite Environment Variables Docs](https://vitejs.dev/guide/env-and-modes.html)
- [CORS Explained](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

