const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:[Blit_Peracc262006]@db.xveakbhekknxpuxzafju.supabase.co:5432/postgres';

async function runMigrations() {
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to Supabase PostgreSQL');

        const sqlPath = path.join(__dirname, 'migrations', '001_create_schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing migration 001_create_schema.sql...');
        await client.query(sql);
        console.log('Migration successful!');

    } catch (err) {
        console.error('Error executing migration:', err);
    } finally {
        await client.end();
        console.log('Disconnected.');
    }
}

runMigrations();
