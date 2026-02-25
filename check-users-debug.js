const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'pokedex',
  user: 'postgres',
  password: '123'
});

async function checkDatabase() {
  try {
    console.log('📊 Verificando usuarios en PostgreSQL...');
    const users = await pool.query('SELECT id, email, name, code FROM users ORDER BY id');
    console.log(`\n👥 Total usuarios: ${users.rows.length}`);
    
    users.rows.forEach(user => {
      console.log(`- ID: ${user.id} | Email: ${user.email} | Nombre: ${user.name} | Código: ${user.code}`);
    });
    
    console.log('\n🔍 Buscando código específico: 6l6wsi');
    const searchResult = await pool.query('SELECT * FROM users WHERE code ILIKE $1', ['6l6wsi']);
    console.log('Resultado:', searchResult.rows.length > 0 ? searchResult.rows[0] : 'NO ENCONTRADO');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkDatabase();