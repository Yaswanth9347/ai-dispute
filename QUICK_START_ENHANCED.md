# 🚀 Quick Start Guide - Enhanced Features

## New Features Available Now

Your AI Dispute Resolution Platform now includes:

1. **Automatic Defender Account Creation** - Defenders get instant access when cases are filed
2. **Sheriff Confirmation Dialog** - Both parties confirm before AI analysis
3. **Court Referral Packages** - Complete ZIP packages ready for court filing

---

## 🏃 Quick Setup (5 minutes)

### Step 1: Run Database Migration
```bash
cd backend
psql $DATABASE_URL -f sql/add_enhanced_features_tables.sql
```

### Step 2: Set Environment Variables
```bash
# Add to backend/.env
FRONTEND_URL=http://localhost:3000

# Optional: SMS notifications
TWILIO_ENABLED=false  # Set to true if you have Twilio
```

### Step 3: Restart Services
```bash
# Backend
cd backend
pnpm install  # archiver already installed
pm2 restart all  # or: node src/index.js

# Frontend (if needed)
cd frontend
pnpm dev
```

---

## 💡 How to Use New Features

### Feature 1: Auto-Create Defender Accounts

**When filing a new case:**
```javascript
// Just include defender details in your case creation
const response = await fetch('/api/cases', {
  method: 'POST',
  body: JSON.stringify({
    title: 'Payment Dispute',
    description: 'Non-payment for services rendered',
    case_type: 'financial',
    
    // Defender details (NEW)
    defender_name: 'John Doe',
    defender_email: 'john@example.com',
    defender_phone: '+919876543210',  // Optional, for SMS
    defender_address: '123 Main St'    // Optional
  })
});

const newCase = await response.json();

// Auto-onboard defender
await fetch(`/api/cases/${newCase.id}/onboard-defender`, {
  method: 'POST',
  body: JSON.stringify({
    defenderDetails: {
      name: newCase.defender_name,
      email: newCase.defender_email,
      phone: newCase.defender_phone
    },
    complainerName: 'Your Name'
  })
});

// ✅ Done! Defender receives:
// - Welcome email with login credentials
// - SMS notification (if phone provided)
// - Automatic account access
```

**Result:** Defender receives email like this:
```
Subject: ⚖️ Dispute Case Filed Against You

Hello John Doe,

A dispute case has been filed against you.

Your Login Credentials:
Email: john@example.com
Password: SecurePass123!

⚠️ Please change this password after first login

You have 48 hours to respond...
```

---

### Feature 2: Sheriff Confirmation Dialog

**Add to your case detail page:**
```typescript
import { ArgumentCompletionDialog } from '@/components/cases/ArgumentCompletionDialog';

function CaseDetailPage() {
  const [showDialog, setShowDialog] = useState(false);

  // Show dialog after 48-hour deadline
  useEffect(() => {
    const deadline = new Date(caseData.statement_deadline);
    if (Date.now() > deadline && !caseData.arguments_confirmed) {
      setShowDialog(true);
    }
  }, [caseData]);

  return (
    <>
      {/* Your existing case UI */}
      
      {/* NEW: Confirmation Dialog */}
      <ArgumentCompletionDialog
        caseId={caseData.id}
        userRole={isComplainer ? 'complainer' : 'defender'}
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        onConfirmed={() => {
          // Refresh to show AI analysis results
          fetchCaseData();
        }}
      />
    </>
  );
}
```

**User Experience:**
1. Dialog appears after 48 hours
2. User checks "I have completed my arguments"
3. User clicks "Confirm Completion"
4. Dialog shows "Waiting for other party..."
5. When both confirm → "AI Sheriff analyzing..."
6. Analysis starts automatically

---

### Feature 3: Create Court Packages

**When case needs court referral:**
```javascript
// Generate court package
const response = await fetch(`/api/cases/${caseId}/create-court-package`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const result = await response.json();

if (result.success) {
  console.log('Package created:', result.data.packagePath);
  console.log('Package size:', result.data.packageSize, 'bytes');
  console.log('Contains:', result.data.manifest.statistics);
  
  // Download link
  const downloadUrl = `/api/downloads/${result.data.packagePath}`;
  
  // Email to parties and court
  await emailCourtPackage(caseId, downloadUrl);
}
```

**Package Contents:**
```
case_123_court_package.zip
├── 01_Cover_Letter.txt
├── 02_Case_Summary.pdf
├── 03_Statements/ (all statements from both parties)
├── 04_Evidences/ (all uploaded files)
├── 05_AI_Analysis_Report.json
├── 06_Settlement_Attempts.json
├── 07_Timeline.json
├── 08_Parties_Information.json
├── MANIFEST.json
└── README_FOR_COURT.txt
```

---

## 🧪 Quick Test

### Test All Features in 5 Minutes

```bash
# 1. Start services
cd backend && npm start &
cd frontend && npm run dev &

# 2. Open browser to http://localhost:3000

# 3. File a new case
# - Login as complainer
# - Click "File New Case"
# - Fill in all details including defender info
# - Submit

# 4. Check defender email (check spam folder)
# - Should receive welcome email with credentials

# 5. Login as defender (use provided credentials)
# - Should see the case
# - Submit some statements

# 6. Wait for 48-hour deadline (or modify deadline in DB for testing)
# - Confirmation dialog should appear for both parties

# 7. Both parties confirm
# - AI analysis should trigger automatically

# 8. If no settlement reached
# - Click "Refer to Court"
# - Court package should be generated
# - Download and verify ZIP contents
```

---

## 🔧 Troubleshooting

### Defender Not Receiving Email?
```bash
# Check SMTP configuration
echo $SMTP_HOST
echo $SMTP_USER

# Check logs
tail -f backend/logs/application.log | grep "email"

# Resend credentials
curl -X POST http://localhost:5000/api/cases/CASE_ID/resend-credentials \
  -H "Content-Type: application/json" \
  -d '{"email": "defender@example.com"}'
```

### Dialog Not Appearing?
```javascript
// Check deadline has passed
const deadline = new Date(caseData.statement_deadline);
console.log('Deadline:', deadline);
console.log('Now:', new Date());
console.log('Passed?', Date.now() > deadline);

// Check status
const statusResponse = await fetch(`/api/cases/${caseId}/argument-status`);
const status = await statusResponse.json();
console.log('Status:', status);
```

### Package Creation Fails?
```bash
# Check storage directory exists
mkdir -p backend/storage/court_packages

# Check permissions
chmod 755 backend/storage/court_packages

# Check archiver installed
cd backend
pnpm list archiver

# Manual test
curl -X POST http://localhost:5000/api/cases/CASE_ID/create-court-package \
  -H "Authorization: Bearer TOKEN"
```

---

## 📊 Monitoring

### Check Feature Health

```javascript
// Defender onboarding stats
SELECT 
  COUNT(*) as total_defenders,
  COUNT(CASE WHEN account_type = 'defender' THEN 1 END) as auto_created,
  COUNT(CASE WHEN requires_password_change THEN 1 END) as pending_password_change
FROM users;

// Confirmation status
SELECT 
  COUNT(*) as total_cases,
  COUNT(CASE WHEN complainer_complete AND defender_complete THEN 1 END) as both_confirmed,
  COUNT(CASE WHEN analysis_triggered THEN 1 END) as analyses_triggered
FROM case_argument_status;

// Court packages
SELECT 
  COUNT(*) as total_packages,
  AVG(package_size) as avg_size,
  MAX(created_at) as last_created
FROM court_referral_packages;
```

---

## 🎯 Next Actions

1. **Test the features** with real case flow
2. **Configure Twilio** (optional) for SMS notifications
3. **Set up email templates** with your branding
4. **Deploy to production** following deployment guide
5. **Monitor usage** and gather user feedback

---

## 📚 Full Documentation

For complete details, see:
- **ENHANCED_FEATURES_COMPLETE.md** - Comprehensive implementation guide
- **FINAL_IMPLEMENTATION_SUMMARY.md** - Complete feature summary
- **Project root README.md** - Overall project documentation

---

## ✅ You're All Set!

Your AI Dispute Resolution Platform now has:
- ✅ Automatic defender onboarding
- ✅ Explicit confirmation before AI analysis
- ✅ Professional court-ready packages

**Start filing cases and watch the magic happen!** 🎉

For support or questions, refer to the documentation or check inline code comments.

---

**Quick Links:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000/api
- API Docs: http://localhost:5000/api-docs (if configured)

**Last Updated:** November 29, 2025
