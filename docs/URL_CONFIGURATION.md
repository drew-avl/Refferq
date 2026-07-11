# URL Configuration Update Summary

## Production URLs Configuration

All application URLs have been updated from localhost to production domains:

### Domain Structure
- **Marketing Website**: `https://referconnect.com`
- **Application**: `https://app.referconnect.com`

---

## ✅ Files Successfully Updated

### 1. Environment Configuration
- **`.env.example`** - Updated `NEXT_PUBLIC_APP_URL` to `https://app.referconnect.com`

### 2. Application Code
- **`src/app/api/auth/register/route.ts`** - Updated default login URL fallback
  - Changed: `http://localhost:3000` → `https://app.referconnect.com`

### 3. Documentation
- **`README.md`** - Updated app URL examples and curl commands
- **`frontend/docs.html`** - Updated environment variables and success message with production URLs

### 4. Frontend Marketing Site
All frontend HTML files have been updated with production URLs:
- **`frontend/index.html`**
  - Meta tags: Open Graph and Twitter Cards
  - Navigation links point to `app.referconnect.com`
  - Hero CTAs updated
  
- **`frontend/features.html`**
  - Meta tags updated
  - Navigation and CTA links updated
  
- **`frontend/pricing.html`**
  - Meta tags updated
  - Navigation and CTA links updated
  
- **`frontend/docs.html`**
  - Code examples and documentation updated

### 5. SEO & Configuration Files
- **`frontend/sitemap.xml`**
  - Marketing pages: `https://referconnect.com/*`
  - App pages: `https://app.referconnect.com/*`
  
- **`frontend/robots.txt`** - Marketing site sitemap URL
- **`public/robots.txt`** - App sitemap URL
- **`frontend/security.txt`** - Canonical URL
- **`frontend/humans.txt`** - Site URL
- **`frontend/README.md`** - Live demo links

---

## 🔧 Configuration Required

### Environment Variables

Update your `.env` file with the production URL:

```bash
# Copy from .env.example
NEXT_PUBLIC_APP_URL="https://app.referconnect.com"

# Database (use production credentials)
DATABASE_URL="postgresql://user:password@host:5432/referconnect"

# Email
SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
SMTP_USER="notifications@referconnect.com"
SMTP_PASSWORD="your-mailbox-password-or-app-password"
SMTP_FROM_EMAIL="ReferConnect <notifications@referconnect.com>"

# JWT
JWT_SECRET="your-production-secret-min-32-chars"
```

### Vercel Configuration

1. **Add Custom Domains** in Vercel Dashboard:
   ```
   Primary Domain: referconnect.com → Frontend
   App Domain: app.referconnect.com → Next.js App
   ```

2. **Environment Variables** in Vercel:
   - Add `NEXT_PUBLIC_APP_URL=https://app.referconnect.com`
   - Add all other production environment variables

3. **DNS Configuration**:
   ```
   A     @                  → Vercel IP
   CNAME app.referconnect.com    → cname.vercel-dns.com
   CNAME www.referconnect.com    → cname.vercel-dns.com (optional)
   ```

---

## 📋 Remaining Updates Needed

Some documentation files still reference localhost for development purposes. These are intentionally left as examples:

### Development Documentation (Keep as localhost examples):
- `wiki/Quick-Start-Guide.md` - Local development instructions
- `wiki/API-Overview.md` - API example commands
- `wiki/Contributing.md` - Contributor setup guide
- `docs/EMAIL_IMPLEMENTATION.md` - Email testing guide
- `scripts/test-email.js` - Test script
- `ANNOUNCEMENT.md` - Setup instructions
- `RELEASE_NOTES.md` - Quick start guide

**Note**: These files contain localhost references for **development/testing purposes** and should remain that way so developers can follow the guides locally.

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Update `.env` with production values
- [ ] Verify DATABASE_URL points to production database
- [ ] Confirm Microsoft 365 SMTP credentials are active
- [ ] Set strong JWT_SECRET (32+ characters)
- [ ] Update SMTP_FROM_EMAIL to your domain

### DNS & SSL
- [ ] Configure DNS A/CNAME records
- [ ] Verify SSL certificates are active (HTTPS)
- [ ] Test both domains resolve correctly
- [ ] Verify redirects (www → non-www or vice versa)

### Vercel Setup
- [ ] Add both domains in Vercel project
- [ ] Set environment variables in Vercel dashboard
- [ ] Configure production branch (main)
- [ ] Enable automatic deployments
- [ ] Test deployment preview

### Post-Deployment Testing
- [ ] Visit https://referconnect.com (marketing site)
- [ ] Visit https://app.referconnect.com (application)
- [ ] Test user registration flow
- [ ] Verify emails are sent with correct URLs
- [ ] Check all internal links work
- [ ] Test affiliate dashboard
- [ ] Test admin dashboard
- [ ] Verify API endpoints respond correctly

### SEO & Monitoring
- [ ] Submit sitemap to Google Search Console
- [ ] Submit sitemap to Bing Webmaster Tools
- [ ] Add domain to analytics (if using)
- [ ] Set up uptime monitoring
- [ ] Verify meta tags render correctly
- [ ] Test social media sharing (Open Graph)

---

## 📝 Quick Reference

### Application URLs
| Purpose | URL |
|---------|-----|
| Marketing Homepage | https://referconnect.com |
| Features Page | https://referconnect.com/features.html |
| Pricing Page | https://referconnect.com/pricing.html |
| Documentation | https://referconnect.com/docs.html |
| User Registration | https://app.referconnect.com/register |
| User Login | https://app.referconnect.com/login |
| Admin Dashboard | https://app.referconnect.com/admin |
| Affiliate Dashboard | https://app.referconnect.com/affiliate |

### API Endpoints
| Purpose | URL |
|---------|-----|
| Base API URL | https://app.referconnect.com/api |
| Authentication | https://app.referconnect.com/api/auth/* |
| Admin APIs | https://app.referconnect.com/api/admin/* |
| Affiliate APIs | https://app.referconnect.com/api/affiliate/* |
| Tracking APIs | https://app.referconnect.com/api/track/* |

---

## 🆘 Troubleshooting

### Issue: Emails contain localhost URLs
**Solution**: Update `NEXT_PUBLIC_APP_URL` in your production environment variables

### Issue: API calls fail with CORS errors
**Solution**: Verify `NEXT_PUBLIC_APP_URL` is set correctly and matches your domain

### Issue: Redirects not working
**Solution**: Check Vercel domain configuration and DNS settings

### Issue: SSL certificate errors
**Solution**: Ensure Vercel has provisioned SSL for both domains (usually automatic)

### Issue: 404 on marketing pages
**Solution**: Verify frontend files are deployed to the correct domain/project

---

## 📞 Support

If you encounter issues:
1. Check environment variables are set correctly
2. Verify DNS propagation (can take up to 48 hours)
3. Review Vercel deployment logs
4. Consult the [GitHub Discussions](https://github.com/ReferConnect/ReferConnect/discussions)

---

**Last Updated**: October 12, 2025  
**Applies To**: ReferConnect v1.0.0+
