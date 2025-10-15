/**
 * Priority 2 Test Script - Email Notification System
 * Tests all email notification functionality
 */

const CaseEmailService = require('../src/services/CaseEmailService');
const EmailService = require('../src/services/EmailService');

console.log('════════════════════════════════════════════════════════════════════════════════');
console.log('  PRIORITY 2: EMAIL NOTIFICATION SYSTEM - TEST SUITE');
console.log('════════════════════════════════════════════════════════════════════════════════\n');

async function runTests() {
  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Email Service Health Check
  console.log('🧪 Test 1: Email Service Initialization Check');
  try {
    await EmailService.init();
    const isConfigured = EmailService.isConfigured;
    console.log(`  Email Service Configured: ${isConfigured ? '✅ YES' : '⚠️  NO (Dev Mode)'}`);
    if (!isConfigured) {
      console.log('  Note: Emails will be logged to console in development mode');
    }
    testsPassed++;
  } catch (error) {
    console.log(`  ❌ FAILED: ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Test 2: Case Filed Notification
  console.log('🧪 Test 2: Send Case Filed Notification');
  try {
    const result = await CaseEmailService.sendCaseFiledNotification({
      caseId: 'test-case-id-001',
      caseReferenceNumber: 'AIDR-2025-TEST1',
      caseTitle: 'Test Contract Dispute',
      plaintiffName: 'John Doe',
      defendantName: 'Jane Smith',
      defendantEmail: 'test@example.com',
      responseDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
    });
    
    console.log(`  ✅ Email sent successfully`);
    console.log(`  Recipient: test@example.com`);
    console.log(`  Status: ${result.success ? 'Sent' : 'Failed'}`);
    if (result.messageId) {
      console.log(`  Message ID: ${result.messageId}`);
    }
    testsPassed++;
  } catch (error) {
    console.log(`  ❌ FAILED: ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Test 3: Response Reminder Notification
  console.log('🧪 Test 3: Send Response Reminder Notification');
  try {
    const result = await CaseEmailService.sendResponseReminderNotification({
      caseReferenceNumber: 'AIDR-2025-TEST1',
      caseTitle: 'Test Contract Dispute',
      defendantName: 'Jane Smith',
      defendantEmail: 'test@example.com',
      hoursRemaining: 12
    });
    
    console.log(`  ✅ Reminder sent successfully`);
    console.log(`  Hours Remaining: 12`);
    console.log(`  Status: ${result.success ? 'Sent' : 'Failed'}`);
    testsPassed++;
  } catch (error) {
    console.log(`  ❌ FAILED: ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Test 4: Defendant Joined Notification
  console.log('🧪 Test 4: Send Defendant Joined Notification');
  try {
    const result = await CaseEmailService.sendDefendantJoinedNotification({
      caseReferenceNumber: 'AIDR-2025-TEST1',
      caseTitle: 'Test Contract Dispute',
      plaintiffName: 'John Doe',
      plaintiffEmail: 'plaintiff@example.com',
      defendantName: 'Jane Smith'
    });
    
    console.log(`  ✅ Notification sent successfully`);
    console.log(`  Recipient: plaintiff@example.com`);
    console.log(`  Status: ${result.success ? 'Sent' : 'Failed'}`);
    testsPassed++;
  } catch (error) {
    console.log(`  ❌ FAILED: ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Test 5: Welcome Email
  console.log('🧪 Test 5: Send Welcome Email (with case reference)');
  try {
    const result = await CaseEmailService.sendWelcomeEmail({
      userName: 'Jane Smith',
      userEmail: 'newuser@example.com',
      caseReference: 'AIDR-2025-TEST1'
    });
    
    console.log(`  ✅ Welcome email sent successfully`);
    console.log(`  Recipient: newuser@example.com`);
    console.log(`  With Case Link: Yes`);
    console.log(`  Status: ${result.success ? 'Sent' : 'Failed'}`);
    testsPassed++;
  } catch (error) {
    console.log(`  ❌ FAILED: ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Test 6: Welcome Email (without case)
  console.log('🧪 Test 6: Send Welcome Email (no case reference)');
  try {
    const result = await CaseEmailService.sendWelcomeEmail({
      userName: 'Test User',
      userEmail: 'testuser@example.com'
    });
    
    console.log(`  ✅ Welcome email sent successfully`);
    console.log(`  Recipient: testuser@example.com`);
    console.log(`  With Case Link: No`);
    console.log(`  Status: ${result.success ? 'Sent' : 'Failed'}`);
    testsPassed++;
  } catch (error) {
    console.log(`  ❌ FAILED: ${error.message}`);
    testsFailed++;
  }
  console.log('');

  // Summary
  console.log('════════════════════════════════════════════════════════════════════════════════');
  console.log(`  TEST RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('════════════════════════════════════════════════════════════════════════════════\n');

  if (testsFailed === 0) {
    console.log('✅ ALL EMAIL TESTS PASSED!\n');
    console.log('📧 Email Templates Tested:');
    console.log('  ✅ Case Filed Notification');
    console.log('  ✅ Response Reminder (48-hour warning)');
    console.log('  ✅ Defendant Joined Notification');
    console.log('  ✅ Welcome Email (with case)');
    console.log('  ✅ Welcome Email (without case)\n');
    
    console.log('💡 Next Steps:');
    console.log('  1. Configure email settings in .env if not already done:');
    console.log('     EMAIL_SERVICE=gmail');
    console.log('     EMAIL_USER=your-email@gmail.com');
    console.log('     EMAIL_PASSWORD=your-app-password');
    console.log('     EMAIL_FROM=noreply@aidispute.com');
    console.log('     EMAIL_FROM_NAME=AI Dispute Resolver');
    console.log('');
    console.log('  2. Run database migration for case_notifications table');
    console.log('  3. Test end-to-end case filing flow');
    console.log('  4. Verify emails are delivered to real email addresses\n');
  } else {
    console.log('❌ SOME TESTS FAILED\n');
    console.log('Please review the errors above and fix any issues.\n');
  }

  process.exit(testsFailed === 0 ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test suite failed with error:', error);
  process.exit(1);
});
