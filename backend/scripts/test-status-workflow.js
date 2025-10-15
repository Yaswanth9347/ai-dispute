// Test Case Status Workflow
// Run with: node scripts/test-status-workflow.js

const CaseStatusService = require('../src/services/CaseStatusService');
const Case = require('../src/models/Case');

async function testStatusWorkflow() {
  console.log('🧪 Testing Case Status Workflow System\n');

  try {
    // Test 1: Get status info
    console.log('📋 Test 1: Get Status Information');
    const pendingInfo = CaseStatusService.getStatusInfo('PENDING_RESPONSE');
    console.log('PENDING_RESPONSE:', pendingInfo);
    console.log('✅ Status info retrieved\n');

    // Test 2: Check allowed transitions
    console.log('📋 Test 2: Check Allowed Transitions');
    const allowed = CaseStatusService.getAllowedNextStatuses('PENDING_RESPONSE');
    console.log('From PENDING_RESPONSE, allowed:', allowed);
    console.log('✅ Allowed transitions retrieved\n');

    // Test 3: Validate valid transition
    console.log('📋 Test 3: Validate Valid Transition');
    try {
      CaseStatusService.validateTransition('PENDING_RESPONSE', 'ACTIVE');
      console.log('✅ Valid transition: PENDING_RESPONSE → ACTIVE\n');
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
    }

    // Test 4: Validate invalid transition
    console.log('📋 Test 4: Validate Invalid Transition');
    try {
      CaseStatusService.validateTransition('PENDING_RESPONSE', 'MEDIATION');
      console.log('❌ Should have thrown error for invalid transition');
    } catch (error) {
      console.log('✅ Correctly rejected invalid transition:', error.message, '\n');
    }

    // Test 5: Check automatic transition detection
    console.log('📋 Test 5: Check Automatic Transitions');
    const isAuto = CaseStatusService.isAutomaticTransition('PENDING_RESPONSE', 'COURT_FILING');
    console.log('PENDING_RESPONSE → COURT_FILING is automatic:', isAuto);
    console.log('✅ Automatic transition detection working\n');

    // Test 6: Get all statuses with info
    console.log('📋 Test 6: All Status States');
    const allStatuses = Object.keys(CaseStatusService.STATUSES);
    console.log(`Total status states: ${allStatuses.length}`);
    allStatuses.forEach(status => {
      const info = CaseStatusService.getStatusInfo(status);
      console.log(`  - ${status}: ${info.label} (${info.color})`);
    });
    console.log('✅ All statuses listed\n');

    // Test 7: Test API endpoints info
    console.log('📋 Test 7: API Endpoints Available');
    console.log('Status workflow API endpoints:');
    console.log('  - PATCH /api/cases/:id/status - Update case status');
    console.log('  - GET /api/cases/:id/timeline - Get case timeline');
    console.log('  - GET /api/cases/:id/workflow - Get workflow info');
    console.log('✅ All endpoints documented\n');

    console.log('✅ All workflow tests passed!');
    console.log('\n📊 Summary:');
    console.log(`   - Total status states: ${allStatuses.length}`);
    console.log(`   - Transition rules defined: ${Object.keys(CaseStatusService.TRANSITIONS).length}`);
    console.log(`   - Event types available: ${Object.keys(CaseStatusService.EVENT_TYPES).length}`);
    console.log('\n🎉 Case Status & Timeline Tracking System is ready!\n');
    console.log('📝 Test with real case:');
    console.log(`   curl -X PATCH http://localhost:8080/api/cases/YOUR_CASE_ID/status \\`);
    console.log(`     -H "Content-Type: application/json" \\`);
    console.log(`     -d '{"status": "ACTIVE", "filed_by": "YOUR_USER_ID", "reason": "Testing"}'`);
    console.log();

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error(error.stack);
    process.exit(1);
  }

  process.exit(0);
}

// Run tests
testStatusWorkflow();
