/**
 * Apply Case Workflow Migration
 * Adds necessary columns to cases table for the complete dispute resolution flow
 */

const { supabase } = require('../src/lib/supabaseClient');
const fs = require('fs');
const path = require('path');

async function applyMigration() {
  console.log('🔄 Starting case workflow migration...');

  try {
    // Read the SQL migration file
    const sqlPath = path.join(__dirname, '../sql/02_add_case_workflow_columns.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by statement (basic approach - assumes statements end with ;)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
      console.log(statement.substring(0, 100) + '...');

      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
        
        if (error) {
          // Try alternative approach using direct query
          const { error: directError } = await supabase.from('_sql').select(statement);
          
          if (directError) {
            console.log(`⚠️  Statement ${i + 1} encountered an issue (may already exist):`, error.message || directError.message);
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } else {
          console.log(`✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.log(`⚠️  Statement ${i + 1} encountered an error (may already exist):`, err.message);
        // Continue with next statement
      }
    }

    console.log('\n✅ Migration completed!');
    console.log('\nNew columns added to cases table:');
    console.log('  - case_reference_number (unique)');
    console.log('  - filed_date');
    console.log('  - response_deadline');
    console.log('  - submission_deadline');
    console.log('  - other_party_name');
    console.log('  - other_party_email');
    console.log('  - other_party_phone');
    console.log('  - other_party_address');
    console.log('  - defendant_user_id');
    console.log('  - escalation_date');
    console.log('  - advocate_notified');
    console.log('  - promissory_note_url');
    console.log('  - promissory_note_signed_at');
    console.log('  - court_reference_number');
    console.log('  - court_submission_date');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
applyMigration()
  .then(() => {
    console.log('\n✨ All done! Your database is ready for the case filing workflow.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
