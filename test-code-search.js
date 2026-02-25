const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pokedex',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
});

async function testSearch() {
  try {
    const testCodes = ['csak5jz', 'CSAK5JZ', 'Csak5jz', '5qtpwxc'];
    
    console.log('\n' + '='.repeat(70));
    console.log('🔍 PROBANDO BÚSQUEDA DE CÓDIGOS');
    console.log('='.repeat(70) + '\n');
    
    for (const code of testCodes) {
      console.log(`Buscando código: "${code}"`);
      const result = await pool.query('SELECT id, email, name, code FROM users WHERE code = $1', [code]);
      
      if (result.rows.length > 0) {
        console.log(`  ✅ ENCONTRADO: ${result.rows[0].email} (código: ${result.rows[0].code})`);
      } else {
        console.log(`  ❌ NO ENCONTRADO`);
      }
      console.log('');
    }
    
    // Ahora con ILIKE (case insensitive)
    console.log('\n' + '-'.repeat(70));
    console.log('🔍 PROBANDO CON ILIKE (case insensitive)');
    console.log('-'.repeat(70) + '\n');
    
    for (const code of testCodes) {
      console.log(`Buscando código: "${code}"`);
      const result = await pool.query('SELECT id, email, name, code FROM users WHERE code ILIKE $1', [code]);
      
      if (result.rows.length > 0) {
        console.log(`  ✅ ENCONTRADO: ${result.rows[0].email} (código: ${result.rows[0].code})`);
      } else {
        console.log(`  ❌ NO ENCONTRADO`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

testSearch();
