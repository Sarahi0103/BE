const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'pokedex',
  user: 'postgres',
  password: '123'
});

async function cleanupDuplicateChallenges() {
  try {
    console.log('🧹 Limpiando desafíos pendientes duplicados...');
    
    // Eliminar desafíos pendientes duplicados, mantener solo el más reciente
    await pool.query(`
      DELETE FROM battle_challenges 
      WHERE id IN (
        SELECT id FROM (
          SELECT id, 
                 ROW_NUMBER() OVER (
                   PARTITION BY challenger_id, opponent_id, status 
                   ORDER BY created_at DESC
                 ) as rn
          FROM battle_challenges 
          WHERE status = 'pending'
        ) t 
        WHERE t.rn > 1
      )
    `);
    
    console.log('✅ Desafíos duplicados eliminados');
    
    // Mostrar desafíos restantes
    const remaining = await pool.query(`
      SELECT bc.*, u1.name as challenger_name, u2.name as opponent_name
      FROM battle_challenges bc
      JOIN users u1 ON bc.challenger_id = u1.id
      JOIN users u2 ON bc.opponent_id = u2.id
      WHERE bc.status = 'pending'
      ORDER BY created_at DESC
    `);
    
    console.log(`\n📋 Desafíos pendientes restantes: ${remaining.rows.length}`);
    remaining.rows.forEach(challenge => {
      console.log(`- ${challenge.challenger_name} -> ${challenge.opponent_name} | Fecha: ${challenge.created_at}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

cleanupDuplicateChallenges();