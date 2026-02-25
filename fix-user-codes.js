const { Pool } = require('pg');

// Configuración de PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pokedex',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '123',
});

async function fixUserCodes() {
  try {
    console.log('🔧 Verificando códigos de usuarios...\n');
    
    // Obtener todos los usuarios
    const result = await pool.query('SELECT id, email, name, code FROM users');
    const users = result.rows;
    
    console.log(`📊 Total de usuarios: ${users.length}\n`);
    
    let fixed = 0;
    
    for (const user of users) {
      if (!user.code || user.code === '' || user.code === null) {
        // Generar nuevo código
        const newCode = Math.random().toString(36).slice(2, 9);
        
        await pool.query(
          'UPDATE users SET code = $1 WHERE id = $2',
          [newCode, user.id]
        );
        
        console.log(`✅ Usuario: ${user.email}`);
        console.log(`   Nombre: ${user.name || 'Sin nombre'}`);
        console.log(`   Nuevo código: ${newCode}\n`);
        
        fixed++;
      } else {
        console.log(`✓ Usuario: ${user.email}`);
        console.log(`  Nombre: ${user.name || 'Sin nombre'}`);
        console.log(`  Código existente: ${user.code}\n`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`✅ Proceso completado!`);
    console.log(`   Códigos actualizados: ${fixed}`);
    console.log(`   Total usuarios: ${users.length}`);
    console.log('='.repeat(50));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

fixUserCodes();
