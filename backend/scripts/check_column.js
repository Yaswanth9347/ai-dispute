require('dotenv').config();
const { Client } = require('pg');
(async ()=>{
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('No DATABASE_URL in env');
    process.exit(2);
  }
  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cases' AND column_name = 'created_by'");
    console.log('created_by exists:', res.rows.length > 0);
  } catch (e) {
    console.error('err', e);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
