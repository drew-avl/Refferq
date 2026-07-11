# FAQ (Frequently Asked Questions)

Find quick answers to common questions about ReferConnect.

---

## 📚 Table of Contents

- [General Questions](#general-questions)
- [Installation & Setup](#installation--setup)
- [Features & Functionality](#features--functionality)
- [Technical Questions](#technical-questions)
- [Troubleshooting](#troubleshooting)
- [Pricing & Licensing](#pricing--licensing)
- [Customization](#customization)
- [Integrations](#integrations)
- [Support & Community](#support--community)

---

## General Questions

### What is ReferConnect?

ReferConnect is a comprehensive, open-source referral program management platform built with Next.js, TypeScript, and PostgreSQL. It provides everything you need to create, manage, and scale your referral program.

### Who is ReferConnect for?

- **SaaS Companies** - Grow through referral partnerships
- **E-commerce Stores** - Reward customer referrals
- **Digital Products** - Course creators, software vendors
- **Service Businesses** - Consultants, agencies
- **Marketplaces** - Multi-vendor platforms
- **Membership Sites** - Recurring revenue businesses

### Is ReferConnect really free?

Yes! ReferConnect is 100% free and open-source under the MIT License. You can use it commercially without any licensing fees. However, you'll need to pay for:
- Server hosting (Vercel free tier available)
- Database hosting (many free options)
- Microsoft 365 mailbox and Graph app registration for email delivery
- Optional payment processing (Stripe fees)

### How is ReferConnect different from other referral program platforms?

- ✅ **Open Source** - Full source code access, no vendor lock-in
- ✅ **Self-Hosted** - You control your data and infrastructure
- ✅ **Modern Stack** - Built with latest technologies
- ✅ **Developer Friendly** - Well-documented API, TypeScript
- ✅ **No Hidden Costs** - No per-affiliate or per-transaction fees
- ✅ **Customizable** - Modify anything to fit your needs

---

## Installation & Setup

### What are the system requirements?

**Minimum:**
- Node.js 18+
- PostgreSQL 14+
- 512MB RAM
- 1GB disk space

**Recommended:**
- Node.js 20+
- PostgreSQL 15+
- 2GB RAM
- 5GB disk space

### How long does installation take?

Following our [Quick Start Guide](Quick-Start-Guide), you can have ReferConnect running in **5-10 minutes**.

### Do I need coding knowledge to use ReferConnect?

**Basic Usage:** No coding required for day-to-day operations
**Installation:** Basic command line knowledge helpful
**Customization:** JavaScript/TypeScript knowledge required for modifications

### Can I install ReferConnect on shared hosting?

ReferConnect requires Node.js and PostgreSQL, which most shared hosting doesn't support. We recommend:
- **Vercel** (easiest, free tier available)
- **DigitalOcean** (affordable, $5/month)
- **AWS** (scalable, pay-as-you-go)
- **Docker** (self-hosted)

### What database does ReferConnect use?

ReferConnect uses **PostgreSQL** via Prisma ORM. Support for MySQL/MariaDB is planned for future releases.

---

## Features & Functionality

### How does referral tracking work?

ReferConnect tracks referrals in two ways:

1. **Manual Submission** - Affiliates submit leads through the portal
2. **Automatic Tracking** - Using unique referral links with codes (coming in v1.1)

### Can I set different commission rates for different affiliates?

Currently, commissions are set globally in program settings. Per-affiliate commission rates are planned for v1.3.0. See our [Roadmap](Roadmap).

### How are commissions calculated?

Commissions can be:
- **Percentage-based** - e.g., 20% of sale value
- **Fixed amount** - e.g., $50 per referral

Calculations happen automatically when a referral is approved.

### What payout methods are supported?

**Current (v1.0.0):**
- PayPal
- Zelle

### How often can affiliates receive payouts?

You control the payout frequency:
- Weekly
- Bi-weekly
- Monthly
- On-demand

Set minimum thresholds to optimize transaction costs.

### Can I approve/reject referrals?

Yes! All referrals start as **PENDING** and require admin approval. You can:
- Approve with commission
- Reject with notes
- Edit referral details

### Do affiliates need approval to join?

Yes, by default. New affiliates have **PENDING** status and must be approved by an admin to become **ACTIVE**.

### Can I disable email notifications?

Currently, email notifications are sent for key events. Email preference management is planned for v1.2.0.

---

## Technical Questions

### What technologies does ReferConnect use?

**Frontend:**
- Next.js 15 (React 19)
- TypeScript
- Tailwind CSS

**Backend:**
- Next.js API Routes
- PostgreSQL
- Prisma ORM

**Infrastructure:**
- JWT authentication (jose)
- Microsoft Graph / Microsoft 365 (email)
- Stripe (optional payments)

### Is ReferConnect production-ready?

Yes! Version 1.0.0 is stable and production-ready. We recommend:
- Proper environment configuration
- SSL/HTTPS in production
- Regular database backups
- Monitoring and logging

### How scalable is ReferConnect?

ReferConnect can scale to:
- **100+ affiliates** - Single server
- **1,000+ affiliates** - Optimized configuration
- **10,000+ affiliates** - Load balancing (planned v1.5.0)

Performance depends on your infrastructure and optimization.

### Can I use ReferConnect with my existing application?

Yes! ReferConnect provides a REST API that you can integrate with any application. Use webhooks (coming v1.1.0) for real-time updates.

### Does ReferConnect have an API?

Yes! ReferConnect has a comprehensive REST API with 31 endpoints. See our [API Overview](API-Overview) for details.

### Is ReferConnect mobile-friendly?

Yes, ReferConnect is fully responsive and works on mobile devices. Native mobile apps are planned for v1.5.0.

### Can I use ReferConnect offline?

No, ReferConnect requires an internet connection. It's a web application that needs server communication.

---

## Troubleshooting

### Emails are not being sent

**Check:**
1. `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, and `MICROSOFT_CLIENT_SECRET` in .env.local
2. Microsoft Graph `Mail.Send` application permission with admin consent
3. `MICROSOFT_GRAPH_SENDER` points to a real Exchange Online mailbox
4. Spam/junk folder
5. Run test: `npm run test:email your@email.com`

See [Email System](Email-System) for detailed troubleshooting.

### "Database connection failed" error

**Solutions:**
1. Check if PostgreSQL is running: `pg_isready`
2. Verify DATABASE_URL in .env.local
3. Ensure database exists: `createdb referconnect`
4. Check network connectivity

### "Port 3000 already in use" error

**Solutions:**
```bash
# Find process using port
lsof -ti:3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows

# Or use different port
npm run dev -- -p 3001
```

### Build fails with TypeScript errors

**Solutions:**
1. Delete `.next` folder: `rm -rf .next`
2. Regenerate Prisma: `npm run db:generate`
3. Clear node_modules: `rm -rf node_modules && npm install`
4. Check Node.js version: `node -v` (requires 18+)

### Can't log in after registration

**Check:**
1. User status is ACTIVE (not PENDING)
2. JWT_SECRET is set in .env.local
3. Cookies are enabled in browser
4. Clear browser cache and try again

---

## Pricing & Licensing

### Is ReferConnect really free forever?

Yes! ReferConnect is MIT licensed, which means:
- ✅ Free to use
- ✅ Free to modify
- ✅ Free for commercial use
- ✅ No hidden costs
- ✅ No licensing fees

### What does the MIT License allow?

You can:
- ✅ Use commercially
- ✅ Modify the source code
- ✅ Distribute your modifications
- ✅ Use privately
- ✅ Sell products built with ReferConnect

You must:
- ⚠️ Include the original license
- ⚠️ Credit the ReferConnect Team

You cannot:
- ❌ Hold us liable
- ❌ Use our trademarks without permission

### Are there any transaction fees?

No! ReferConnect doesn't charge any fees. However:
- Payment processors (Stripe) charge their fees
- Email services or Microsoft 365 mailboxes may have sending limits

### Do I need to pay for updates?

No, all updates are free forever.

### Can I remove "Powered by ReferConnect"?

Yes, the MIT License allows you to remove any branding. However, we'd appreciate attribution!

### Is there a paid version?

Currently no. ReferConnect is 100% open source. We may offer paid support or custom development in the future.

---

## Customization

### Can I customize the design?

Yes! You can:
- Modify Tailwind CSS classes
- Change colors and fonts
- Create custom themes
- Replace logos and images
- Modify layouts

See [White Label Guide](White-Label-Guide) for details.

### Can I add custom fields?

Yes, you can modify the database schema and forms. Knowledge of TypeScript and Prisma required.

### Can I integrate with my existing design system?

Yes, ReferConnect uses standard React components. You can replace them with your own components.

### Can I use a different database?

Currently, only PostgreSQL is supported. MySQL/MariaDB support is planned for v1.2.0.

---

## Integrations

### Does ReferConnect integrate with Shopify?

Not yet. Shopify integration is planned for v1.4.0. See [Roadmap](Roadmap).

### Can I integrate with my CRM?

Yes, via API. Pre-built integrations for HubSpot, Salesforce, etc. are planned for v1.4.0.

### Does ReferConnect work with WordPress?

Not directly, but you can embed referral links or use the API to integrate.

### Can I use Zapier?

Zapier integration is planned for v1.4.0. Until then, use webhooks (coming v1.1.0) or the API.

### Does ReferConnect have webhooks?

Webhook support is coming in v1.1.0 (November 2025). See [Roadmap](Roadmap).

---

## Support & Community

### Where can I get help?

- **[Wiki](Home)** - Documentation and guides
- **[GitHub Issues](https://github.com/referconnect/referconnect/issues)** - Bug reports
- **[GitHub Discussions](https://github.com/referconnect/referconnect/discussions)** - Questions and ideas
- **Email** - hello@referconnect.com

### How do I report a bug?

1. Check [existing issues](https://github.com/referconnect/referconnect/issues)
2. Create a [new issue](https://github.com/referconnect/referconnect/issues/new)
3. Include:
   - ReferConnect version
   - Steps to reproduce
   - Expected vs actual behavior
   - Error messages/logs

### How do I request a feature?

1. Check [Roadmap](Roadmap) to see if it's planned
2. Search [existing requests](https://github.com/referconnect/referconnect/discussions)
3. Create a [new discussion](https://github.com/referconnect/referconnect/discussions/new)
4. Explain the feature and use case

### Can I hire someone to customize ReferConnect?

Yes! You can:
- Hire freelance developers
- Contact us for custom development: hello@referconnect.com
- Post in GitHub Discussions to find community developers

### How can I contribute?

See our [Contributing Guide](Contributing) for details. We welcome:
- Code contributions
- Documentation improvements
- Bug reports
- Feature suggestions
- Testing

### Is there a Discord/Slack community?

Not yet. Community channels are planned for when we reach 500+ GitHub stars.

---

## Security & Privacy

### Is ReferConnect secure?

Yes, ReferConnect follows security best practices:
- JWT authentication
- Password hashing (bcrypt)
- SQL injection prevention (Prisma)
- XSS prevention
- CSRF protection recommended

See [Security Best Practices](Security-Best-Practices) for production hardening.

### Where is data stored?

Data is stored in your PostgreSQL database. You control where the database is hosted.

### Is ReferConnect GDPR compliant?

ReferConnect provides the tools, but GDPR compliance depends on how you use it. You're responsible for:
- Privacy policy
- Cookie consent
- Data processing agreements
- Right to deletion
- Data export

### Can I delete user data?

Yes, admins can delete users, which removes all associated data (affiliates, referrals, commissions).

### How are passwords stored?

Passwords are hashed using bcrypt before storage. We never store plain-text passwords.

### Does ReferConnect track users?

ReferConnect tracks affiliate activity (referrals, commissions) for program management. No third-party tracking by default.

---

## Migration & Upgrades

### How do I upgrade to a new version?

```bash
git pull origin main
npm install
npm run db:generate
npm run build
```

See [Migration Guides](Migration-Guides) for version-specific instructions.

### Can I migrate from another platform?

Manual migration is possible by importing data directly into PostgreSQL. Automated migration tools are planned for v1.2.0.

### Will my data be safe during upgrades?

Always backup your database before upgrading! See [Backup & Recovery](Backup-Recovery).

---

## Performance

### How many affiliates can ReferConnect handle?

Performance depends on your infrastructure:
- **Small (< 100)** - Free tier hosting (Vercel)
- **Medium (100-1,000)** - Basic VPS ($10-20/month)
- **Large (1,000-10,000)** - Dedicated server or cluster
- **Enterprise (10,000+)** - Load balancing (planned v1.5.0)

### Is there a limit on referrals?

No technical limit. Database and storage are the only constraints.

### How can I optimize performance?

- Use Redis caching (planned v1.5.0)
- Enable database indexing (included)
- Use CDN for static assets
- Optimize Prisma queries
- Scale vertically or horizontally

---

## Still Have Questions?

- **Search this wiki** - Use the search bar
- **Check GitHub Issues** - Someone may have asked
- **Ask in Discussions** - [GitHub Discussions](https://github.com/referconnect/referconnect/discussions)
- **Email us** - hello@referconnect.com

---

<p align="center">
  <strong>Didn't find your answer?</strong><br>
  Ask in <a href="https://github.com/referconnect/referconnect/discussions">GitHub Discussions</a>
</p>

<p align="center">
  Last Updated: February 17, 2026
</p>
