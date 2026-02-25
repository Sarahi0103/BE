const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pokedex',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
});

async function checkUsers() {
  try {
    const result = await pool.query('SELECT id, email, name, code FROM users ORDER BY id');
    
    console.log('\n' + '='.repeat(70));
    console.log('📋 TODOS LOS USUARIOS Y SUS CÓDIGOS');
    console.log('='.repeat(70) + '\n');
    
    result.rows.forEach(user => {
      console.log(`ID: ${user.id}`);
      console.log(`📧 Email: ${user.email}`);
      console.log(`👤 Nombre: ${user.name || 'Sin nombre'}`);
      console.log(`🔑 Código: ${user.code}`);
      console.log('-'.repeat(70));
    });
    
    console.log('\n✅ Total de usuarios:', result.rows.length);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkUsers();
