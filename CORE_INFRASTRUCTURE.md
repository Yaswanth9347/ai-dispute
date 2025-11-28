# Core Infrastructure Implementation - AI Dispute Resolver

This document outlines the **Phase 1: Core Infrastructure** implementation for the AI Dispute Resolver system.

## 🏗️ What's Been Implemented

### 1. **Enhanced Case Model** ✅
- **Defender Information Fields**: Added fields for defender name, email, phone, and address
- **Dispute Workflow Fields**: Added timeline tracking for statement deadlines, AI analysis, and solution generation
- **Notification Methods**: Built-in methods to notify defenders via email and SMS
- **Workflow Management**: Methods to manage statement phases and AI analysis triggers

### 2. **Statement Management System** ✅
- **Real-time Statement Submission**: Both parties can submit statements with real-time updates
- **Party Type Detection**: Automatically determines if user is complainer or defender
- **Time-based Editing**: Statements can be edited within 15 minutes, deleted within 5 minutes
- **Evidence Attachment**: Link evidence files to specific statements
- **Completion Tracking**: Automatically detect when both parties have submitted statements

### 3. **Enhanced Evidence Management** ✅
- **Statement Integration**: Evidence can be attached to specific statements
- **Party Filtering**: Get evidence by party type (complainer vs defender)
- **Real-time Updates**: Live notifications when evidence is uploaded or processed
- **Access Control**: Proper permissions and secure download URLs
- **AI Processing**: Enhanced support for AI analysis of evidence

### 4. **Email Service Enhancement** ✅
- **Dispute-Specific Templates**: Professional email templates for all dispute workflow stages
- **Defender Notifications**: Comprehensive legal notice emails when cases are filed
- **Deadline Reminders**: Automated reminders for statement submission deadlines
- **AI Analysis Updates**: Notifications when AI generates settlement options
- **Settlement Communications**: Emails for consensus reached and final documents

### 5. **SMS Notification Service** ✅
- **Twilio Integration**: Complete SMS service using Twilio API
- **Dispute Notifications**: SMS alerts for case filing, deadlines, and updates
- **Phone Validation**: Smart phone number formatting and validation
- **International Support**: Handles various phone number formats
- **Bulk Messaging**: Support for sending messages to multiple recipients

### 6. **Real-Time Communication** ✅
- **Socket.io Integration**: Already configured and enhanced
- **Case Rooms**: Users automatically join rooms for their cases
- **Live Updates**: Real-time notifications for statements, evidence, and case updates
- **Typing Indicators**: Show when users are typing in case discussions
- **Connection Management**: Proper user connection tracking and cleanup

## 📁 New Files Created

### Models
- `backend/src/models/Statement.js` - Complete statement management
- Enhanced `backend/src/models/Case.js` - Added defender fields and workflow methods
- Enhanced `backend/src/models/Evidence.js` - Added statement integration

### Services
- `backend/src/services/SMSService.js` - Complete Twilio SMS integration
- Enhanced `backend/src/services/EmailService.js` - Added dispute-specific templates
- Enhanced `backend/src/services/RealTimeService.js` - Already existed and working

### Database
- `backend/sql/add_core_infrastructure.sql` - Complete database schema updates

### Configuration
- `backend/.env.example` - Environment configuration template
- `backend/test-core-infrastructure.js` - Infrastructure testing script

## 🚀 Installation & Setup

### 1. Install Dependencies
```bash
cd backend
pnpm install twilio resend
```

### 2. Database Setup
Run the SQL script in your Supabase SQL editor:
```sql
-- Execute the contents of backend/sql/add_core_infrastructure.sql
```

### 3. Environment Configuration
Copy and configure the environment variables:
```bash
cp .env.example .env
# Edit .env with your actual configuration
```

Required variables:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `JWT_SECRET`, `FRONTEND_URL`

Optional (for full functionality):
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (or `SENDGRID_API_KEY`)

### 4. Test the Infrastructure
```bash
node test-core-infrastructure.js
```

### 5. Start the Server
```bash
npm run dev
```

## 🔧 API Endpoints Added

### Case Filing with Defender Info
```javascript
POST /api/disputes/file
{
  "title": "Contract Dispute",
  "description": "Dispute over contract terms...",
  "case_type": "contract",
  "defenderInfo": {
    "name": "John Defender",
    "email": "defender@example.com",
    "phone": "+91-9876543210",
    "address": "123 Main St"
  }
}
```

### Statement Management
```javascript
// Submit statement
POST /api/disputes/:caseId/statements
{
  "content": "This is my statement regarding the dispute...",
  "statement_type": "written"
}

// Get all statements for a case
GET /api/disputes/:caseId/statements

// Update statement (within 15 minutes)
PUT /api/disputes/statements/:statementId
{
  "content": "Updated statement content..."
}
```

### Evidence Management
```javascript
// Attach evidence to statement
POST /api/disputes/statements/:statementId/evidence
{
  "evidenceIds": ["evidence-uuid-1", "evidence-uuid-2"]
}

// Get evidence by party
GET /api/disputes/:caseId/evidence?party=complainer
```

## 🔄 Real-Time Events

The system now emits these Socket.io events:

### Statement Events
- `statement_added` - When a statement is submitted
- `statement_updated` - When a statement is edited
- `statement_deleted` - When a statement is removed

### Evidence Events
- `evidence_uploaded` - When evidence is attached
- `evidence_processed` - When AI analysis is complete
- `evidence_deleted` - When evidence is removed

### Case Events
- `case_notification` - General case updates
- `status_changed` - When case status changes

## 📊 Workflow Implementation

### 1. **Case Filing Process** ✅
```
1. User files case with defender information
2. System automatically sends email + SMS to defender
3. Case status changes to "open"
4. Both parties can now access the case
```

### 2. **Statement Collection Phase** ✅
```
1. System starts 48-hour statement deadline
2. Both parties receive notifications
3. Real-time updates as statements are submitted
4. Auto-progression when both parties complete statements
```

### 3. **Evidence Attachment** ✅
```
1. Users upload evidence files
2. Evidence can be attached to specific statements
3. Real-time processing and AI analysis
4. Automatic relevance scoring
```

## 🧪 Testing

### Run Infrastructure Tests
```bash
node test-core-infrastructure.js
```

### Test Email/SMS (Optional)
Set these in your .env for testing:
```
TEST_EMAIL=your-email@example.com
TEST_PHONE=+91-9876543210
```

### Manual Testing Workflow
1. File a dispute case with defender info
2. Check defender receives email/SMS notifications
3. Submit statements from both parties
4. Verify real-time updates work
5. Attach evidence to statements
6. Test case status transitions

## 🔐 Security Features

### Database Security
- **Row Level Security (RLS)**: Users can only access their own cases and statements
- **Proper Indexing**: Optimized for performance with secure queries
- **Data Validation**: Strong validation at model and API level

### Access Control
- **JWT Authentication**: All endpoints require valid JWT tokens
- **Role-based Access**: Complainer vs Defender permissions
- **Time-based Restrictions**: Edit/delete windows for statements

### Communication Security
- **CORS Configuration**: Proper Socket.io and Express CORS setup
- **Input Sanitization**: All user inputs are validated and sanitized
- **Rate Limiting**: Built into Express app configuration

## 📈 What's Next: Phase 2

The Core Infrastructure is now complete. Next phase should implement:

1. **Case Management UI**: Frontend components for filing and managing cases
2. **Real-time Statement Interface**: Live statement submission with Socket.io
3. **AI Analysis Engine**: Integration with AI services for case analysis
4. **Settlement Options Generation**: AI-powered solution generation
5. **Signature Collection**: Digital signature workflow

## 🐛 Troubleshooting

### Common Issues

1. **Database Errors**: Make sure to run the SQL script in Supabase
2. **Email Not Sending**: Check SMTP configuration or use development mode
3. **SMS Not Working**: Verify Twilio credentials
4. **Socket.io Connection Issues**: Check CORS and JWT configuration

### Debug Mode
Enable detailed logging:
```
DEBUG_MODE=true
NODE_ENV=development
```

### Development Mode
For development without external services:
```
TEST_MODE=true
```
This will log emails/SMS to console instead of sending them.

## 📞 Support

For issues with this implementation:
1. Check the test script output: `node test-core-infrastructure.js`
2. Review the environment configuration in `.env.example`
3. Verify database schema with the SQL script
4. Check server logs for detailed error messages

---

**Status**: ✅ **Core Infrastructure Complete**
**Next Phase**: Case Management & AI Integration
**Estimated Progress**: 40% of total project completed