# 🚀 Production Deployment Checklist

## Pre-Deployment Verification

### ✅ All Features Complete
- [x] Defender Auto-Registration Service
- [x] Sheriff Confirmation Dialog
- [x] Court Referral Package System
- [x] API Endpoints Integrated
- [x] Database Migrations Ready

---

## Deployment Steps

### 1. Database Migration
```bash
# Connect to production database
psql $PRODUCTION_DATABASE_URL -f backend/sql/add_enhanced_features_tables.sql

# Verify tables created
psql $PRODUCTION_DATABASE_URL -c "\dt case_argument_status"
psql $PRODUCTION_DATABASE_URL -c "\dt court_referral_packages"

# Check columns added
psql $PRODUCTION_DATABASE_URL -c "\d users"
psql $PRODUCTION_DATABASE_URL -c "\d cases"
```

### 2. Environment Variables
```bash
# Production .env (backend)
DATABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-secure-jwt-secret

# Email Configuration (REQUIRED)
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=AI Dispute Platform <noreply@ai-dispute.com>

# SMS Configuration (OPTIONAL)
TWILIO_ENABLED=true
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Application URLs
FRONTEND_URL=https://your-production-domain.com
NODE_ENV=production

# OpenAI API (for AI Sheriff)
OPENAI_API_KEY=your-openai-key
```

### 3. Install Dependencies
```bash
cd backend
pnpm install --production

# Verify critical packages
pnpm list archiver    # For court packages
pnpm list bcrypt      # For password hashing
pnpm list nodemailer  # For emails
```

### 4. Create Storage Directories
```bash
cd backend
mkdir -p storage/court_packages
mkdir -p storage/documents
mkdir -p storage/evidences
mkdir -p storage/signatures

# Set permissions
chmod 755 storage/court_packages
chmod 755 storage/documents
chmod 755 storage/evidences
chmod 755 storage/signatures
```

### 5. Test Services
```bash
# Test email service
node -e "
const EmailService = require('./src/services/EmailService');
EmailService.sendTestEmail('your-test@email.com')
  .then(() => console.log('✅ Email service working'))
  .catch(err => console.error('❌ Email failed:', err));
"

# Test SMS service (if enabled)
node -e "
const SMSService = require('./src/services/SMSService');
SMSService.sendSMS('+919876543210', 'Test message')
  .then(() => console.log('✅ SMS service working'))
  .catch(err => console.error('❌ SMS failed:', err));
"
```

### 6. Deploy Backend
```bash
# Using PM2 (recommended)
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Verify running
pm2 status
pm2 logs ai-dispute-backend --lines 50

# Test API health
curl https://your-api-domain.com/api/health
```

### 7. Deploy Frontend
```bash
cd frontend

# Build production bundle
pnpm build

# Test build locally
pnpm start

# Deploy (choose one):
# - Vercel: vercel --prod
# - Netlify: netlify deploy --prod
# - PM2: pm2 start npm --name "ai-dispute-frontend" -- start
```

### 8. Verify Deployments
```bash
# Backend health check
curl https://api.your-domain.com/api/health
# Expected: {"status":"ok","timestamp":"..."}

# Frontend check
curl https://your-domain.com
# Expected: 200 OK with HTML

# API endpoints check
curl https://api.your-domain.com/api/cases \
  -H "Authorization: Bearer TEST_TOKEN"
# Expected: JSON response or 401 if token invalid
```

---

## Post-Deployment Testing

### Test 1: Defender Onboarding (Critical)
```bash
# 1. Create a test case via API or UI
# 2. Include defender details (use your test email)
# 3. Call onboard-defender endpoint
# 4. Check email inbox (and spam) for welcome email
# 5. Verify login works with provided credentials
# 6. Check database for new user record

curl -X POST https://api.your-domain.com/api/cases/CASE_ID/onboard-defender \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "defenderDetails": {
      "name": "Test Defender",
      "email": "test@yourdomain.com",
      "phone": "+919876543210"
    },
    "complainerName": "Test Complainer"
  }'

# Expected: 201 Created with user ID and notification status
```

### Test 2: Sheriff Confirmation Dialog
```bash
# 1. Create case with both parties
# 2. Submit statements from both sides
# 3. Wait for/manually expire 48-hour deadline
# 4. Open case as both parties
# 5. Verify dialog appears
# 6. Confirm from both sides
# 7. Verify AI analysis triggers
# 8. Check database for confirmation records

# Query database
psql $DATABASE_URL -c "
  SELECT * FROM case_argument_status WHERE case_id = 'CASE_ID';
"
```

### Test 3: Court Package Generation
```bash
# 1. Create case with full data (statements, evidences)
# 2. Progress to court referral stage
# 3. Generate court package

curl -X POST https://api.your-domain.com/api/cases/CASE_ID/create-court-package \
  -H "Authorization: Bearer TOKEN"

# 4. Verify package created in storage/court_packages/
# 5. Download and unzip package
# 6. Verify all files present
# 7. Check manifest.json accuracy

# Expected response
{
  "success": true,
  "data": {
    "packagePath": "/storage/court_packages/case_xxx.zip",
    "packageSize": 15728640,
    "manifest": { ... }
  }
}
```

---

## Monitoring Setup

### 1. Application Logs
```bash
# PM2 logs
pm2 logs ai-dispute-backend --lines 100

# Or use log aggregation service
# - Logtail
# - Papertrail
# - CloudWatch Logs
```

### 2. Error Tracking
```bash
# Install Sentry (optional)
npm install @sentry/node

# Add to backend/src/index.js
const Sentry = require("@sentry/node");
Sentry.init({ dsn: process.env.SENTRY_DSN });
```

### 3. Email/SMS Monitoring
```sql
-- Track email delivery
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient VARCHAR(255),
  subject TEXT,
  status VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Track SMS delivery
CREATE TABLE sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient VARCHAR(50),
  message TEXT,
  status VARCHAR(50),
  twilio_sid VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. Performance Metrics
```javascript
// Add to backend/src/middleware/performanceMiddleware.js
const prometheus = require('prom-client');

// Track response times
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

// Track court package generation
const courtPackageGeneration = new prometheus.Histogram({
  name: 'court_package_generation_seconds',
  help: 'Time to generate court packages',
  labelNames: ['case_id']
});
```

---

## Rollback Plan

### If Issues Occur

```bash
# 1. Rollback code deployment
pm2 reload ai-dispute-backend --update-env
# Or use git: git checkout previous-version

# 2. Rollback database (if needed)
psql $DATABASE_URL -c "
  DROP TABLE IF EXISTS case_argument_status CASCADE;
  DROP TABLE IF EXISTS court_referral_packages CASCADE;
  ALTER TABLE users DROP COLUMN IF EXISTS account_type;
  ALTER TABLE users DROP COLUMN IF EXISTS onboarding_case_id;
  ALTER TABLE users DROP COLUMN IF EXISTS requires_password_change;
  ALTER TABLE cases DROP COLUMN IF EXISTS defender_notified_at;
  ALTER TABLE cases DROP COLUMN IF EXISTS defender_user_id;
"

# 3. Restart services
pm2 restart all

# 4. Verify system stable
curl https://api.your-domain.com/api/health
```

---

## Maintenance Tasks

### Daily
- [ ] Monitor error logs
- [ ] Check email delivery rates
- [ ] Verify SMS sending (if enabled)

### Weekly
- [ ] Review court package generation times
- [ ] Clean up old court packages (90+ days)
- [ ] Check disk space for storage directories
- [ ] Monitor database growth

### Monthly
- [ ] Review and update email templates
- [ ] Analyze defender onboarding success rates
- [ ] Check for failed credentials resends
- [ ] Update dependencies (security patches)

---

## Success Metrics

### Track These KPIs

```sql
-- Defender onboarding success rate
SELECT 
  COUNT(*) as total_defenders,
  COUNT(CASE WHEN account_type = 'defender' THEN 1 END) as auto_created,
  ROUND(COUNT(CASE WHEN account_type = 'defender' THEN 1 END)::NUMERIC / 
        COUNT(*)::NUMERIC * 100, 2) as success_rate
FROM users
WHERE created_at > NOW() - INTERVAL '30 days';

-- Confirmation dialog usage
SELECT 
  COUNT(*) as total_cases,
  COUNT(CASE WHEN complainer_complete AND defender_complete THEN 1 END) as both_confirmed,
  ROUND(COUNT(CASE WHEN complainer_complete AND defender_complete THEN 1 END)::NUMERIC / 
        COUNT(*)::NUMERIC * 100, 2) as completion_rate
FROM case_argument_status
WHERE created_at > NOW() - INTERVAL '30 days';

-- Court package generation
SELECT 
  COUNT(*) as total_packages,
  AVG(package_size / 1024 / 1024) as avg_size_mb,
  MAX(created_at) as last_generated
FROM court_referral_packages
WHERE created_at > NOW() - INTERVAL '30 days';

-- Email delivery (if tracked)
SELECT 
  COUNT(*) as total_emails,
  COUNT(CASE WHEN status = 'sent' THEN 1 END) as successful,
  ROUND(COUNT(CASE WHEN status = 'sent' THEN 1 END)::NUMERIC / 
        COUNT(*)::NUMERIC * 100, 2) as delivery_rate
FROM email_logs
WHERE created_at > NOW() - INTERVAL '7 days';
```

---

## Security Checklist

### Before Going Live
- [ ] HTTPS enabled (SSL/TLS certificates)
- [ ] Environment variables not committed to git
- [ ] Database connections encrypted
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled
- [ ] Authentication tokens secure (JWT)
- [ ] Passwords hashed with bcrypt (10+ rounds)
- [ ] File upload validation working
- [ ] Sensitive data not logged
- [ ] Error messages don't leak info

---

## Support Contacts

### Critical Issues
- **Backend Lead:** [Your Name] - [email]
- **Frontend Lead:** [Your Name] - [email]
- **DevOps:** [Your Name] - [email]

### External Services
- **Email Support:** SMTP provider documentation
- **SMS Support:** Twilio support
- **Database:** Supabase support
- **Hosting:** Your hosting provider

---

## Final Verification

### Before Announcing Launch

```bash
# 1. All services running
pm2 status
# Expected: All processes "online"

# 2. Database healthy
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
# Expected: Number returned

# 3. Email working
# Send test email to yourself

# 4. SMS working (if enabled)
# Send test SMS to yourself

# 5. Court packages generating
# Create test package, verify contents

# 6. Frontend accessible
curl https://your-domain.com
# Expected: 200 OK

# 7. API endpoints responding
curl https://api.your-domain.com/api/health
# Expected: {"status":"ok"}

# 8. Authentication working
# Try login flow end-to-end

# 9. Socket.io working
# Test real-time updates

# 10. All documentation updated
# README, API docs, deployment guides
```

---

## 🎉 Launch!

Once all checks pass:

1. **Announce internally** - Inform team of launch
2. **Monitor closely** - Watch logs for first few hours
3. **Be available** - Have team on standby for issues
4. **Collect feedback** - Track user issues and requests
5. **Iterate quickly** - Fix critical bugs immediately

---

## Post-Launch (First Week)

### Day 1
- Monitor every hour
- Fix critical bugs immediately
- Track user feedback

### Day 2-3
- Review error logs twice daily
- Optimize slow queries
- Address user complaints

### Day 4-7
- Daily monitoring
- Performance tuning
- Feature feedback collection

---

## Status Dashboard

Create a status page showing:
- ✅ API Health
- ✅ Database Connectivity
- ✅ Email Service Status
- ✅ SMS Service Status (if enabled)
- ✅ Court Package Generation
- ✅ Recent Error Rate
- ✅ Average Response Time

---

**Deployment Date:** [Your Date]  
**Deployed By:** [Your Name]  
**Version:** 1.0.0 (Enhanced Features Release)

**🚀 READY FOR PRODUCTION DEPLOYMENT 🚀**
