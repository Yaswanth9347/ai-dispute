// Check Database Tables
require('dotenv').config();
const { Client } = require('pg');

async function checkTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    const result = await client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename;
    `);

    console.log('\nExisting tables:');
    result.rows.forEach(row => console.log('- ' + row.tablename));

    // Check if cases table exists
    const casesResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'cases' AND table_schema = 'public'
      ORDER BY column_name;
    `);

    if (casesResult.rows.length > 0) {
      console.log('\nCases table columns:');
      casesResult.rows.forEach(row => console.log(`- ${row.column_name}: ${row.data_type}`));
    } else {
      console.log('\n❌ Cases table does not exist');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.end();
  }
}

checkTables();