#!/usr/bin/env node

// AI Integration Validation Script
// Validates that all AI integration components are properly configured and working

const path = require('path');
const fs = require('fs');

console.log('🔍 AI Integration Validation');
console.log('============================\n');

const errors = [];
const warnings = [];

// 1. Check file structure
console.log('📁 Checking file structure...');

const requiredFiles = [
  'src/services/AIService.js',
  'src/services/AIWorkflowIntegrationService.js',
  'src/controllers/AIController.js',
  'src/models/AIAnalysis.js',
  'src/models/SettlementOptions.js',
  'src/routes/ai.js',
  'test/ai-workflow-integration.test.js'
];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    console.log(`  ✅ ${file}`);
  } else {
    errors.push(`Missing required file: ${file}`);
    console.log(`  ❌ ${file}`);
  }
});

console.log('');

// 2. Check module imports
console.log('📦 Checking module dependencies...');

try {
  const AIService = require('../src/services/AIService');
  console.log('  ✅ AIService loads successfully');
} catch (error) {
  errors.push(`AIService import failed: ${error.message}`);
  console.log(`  ❌ AIService: ${error.message}`);
}

try {
  const AIWorkflowIntegrationService = require('../src/services/AIWorkflowIntegrationService');
  console.log('  ✅ AIWorkflowIntegrationService loads successfully');
} catch (error) {
  errors.push(`AIWorkflowIntegrationService import failed: ${error.message}`);
  console.log(`  ❌ AIWorkflowIntegrationService: ${error.message}`);
}

try {
  const AIController = require('../src/controllers/AIController');
  console.log('  ✅ AIController loads successfully');
} catch (error) {
  errors.push(`AIController import failed: ${error.message}`);
  console.log(`  ❌ AIController: ${error.message}`);
}

try {
  const AIAnalysis = require('../src/models/AIAnalysis');
  console.log('  ✅ AIAnalysis model loads successfully');
} catch (error) {
  errors.push(`AIAnalysis model import failed: ${error.message}`);
  console.log(`  ❌ AIAnalysis model: ${error.message}`);
}

try {
  const SettlementOptions = require('../src/models/SettlementOptions');
  console.log('  ✅ SettlementOptions model loads successfully');
} catch (error) {
  errors.push(`SettlementOptions model import failed: ${error.message}`);
  console.log(`  ❌ SettlementOptions model: ${error.message}`);
}

console.log('');

// 3. Check environment configuration
console.log('🔧 Checking environment configuration...');

const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const optionalEnvVars = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY'
];

requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`  ✅ ${envVar} is configured`);
  } else {
    errors.push(`Missing required environment variable: ${envVar}`);
    console.log(`  ❌ ${envVar} is missing`);
  }
});

let hasAIKey = false;
optionalEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`  ✅ ${envVar} is configured`);
    hasAIKey = true;
  } else {
    console.log(`  ⚠️  ${envVar} is not configured`);
  }
});

if (!hasAIKey) {
  warnings.push('No AI API keys configured - AI functionality will be limited');
}

console.log('');

// 4. Check package dependencies
console.log('📋 Checking package dependencies...');

try {
  const packageJson = require('../package.json');
  
  const aiDependencies = [
    '@anthropic-ai/sdk',
    'openai'
  ];

  aiDependencies.forEach(dep => {
    if (packageJson.dependencies && packageJson.dependencies[dep]) {
      console.log(`  ✅ ${dep} is installed`);
    } else {
      warnings.push(`AI dependency not installed: ${dep}`);
      console.log(`  ⚠️  ${dep} is not installed`);
    }
  });
} catch (error) {
  warnings.push(`Could not read package.json: ${error.message}`);
}

console.log('');

// 5. Validate API structure
console.log('🔗 Checking API structure...');

try {
  const aiRoutes = fs.readFileSync(path.join(__dirname, '../src/routes/ai.js'), 'utf8');
  
  const requiredRoutes = [
    '/analyze-case',
    '/settlement-options',
    '/select-option',
    '/accept-combined-solution',
    '/case-status'
  ];

  requiredRoutes.forEach(route => {
    if (aiRoutes.includes(route)) {
      console.log(`  ✅ ${route} route is defined`);
    } else {
      errors.push(`Missing API route: ${route}`);
      console.log(`  ❌ ${route} route is missing`);
    }
  });
} catch (error) {
  errors.push(`Could not validate AI routes: ${error.message}`);
}

console.log('');

// 6. Summary
console.log('📊 VALIDATION SUMMARY');
console.log('=====================\n');

if (errors.length === 0 && warnings.length === 0) {
  console.log('🎉 All validations passed! AI Integration is properly configured.');
} else {
  if (errors.length > 0) {
    console.log('❌ ERRORS FOUND:');
    errors.forEach(error => console.log(`  • ${error}`));
    console.log('');
  }

  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    warnings.forEach(warning => console.log(`  • ${warning}`));
    console.log('');
  }

  if (errors.length === 0) {
    console.log('✅ No critical errors found. AI Integration should work with some limitations.');
  } else {
    console.log('❌ Critical errors found. Please fix these before using AI Integration.');
  }
}

console.log('');

// Exit with appropriate code
process.exit(errors.length > 0 ? 1 : 0);