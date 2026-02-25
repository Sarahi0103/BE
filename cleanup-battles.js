const { pool } = require('./lib/db');

async function cleanupCompletedBattles() {
  try {
    console.log('🧹 Limpiando batallas completadas antiguas...\n');
    
    // Mostrar batallas completadas actuales
    const currentResult = await pool.query(
      `SELECT id, challenger_id, opponent_id, status, created_at, completed_at
       FROM battle_challenges 
       WHERE status IN ('completed', 'rejected')
       ORDER BY id DESC`
    );
    
    console.log(`📊 Total de batallas completadas/rechazadas: ${currentResult.rows.length}\n`);
    
    currentResult.rows.forEach(battle => {
      console.log(`  ID: ${battle.id} | Status: ${battle.status} | Creada: ${battle.created_at}`);
    });
    
    // Eliminar batallas completadas o rechazadas
    const deleteResult = await pool.query(
      `DELETE FROM battle_challenges 
       WHERE status IN ('completed', 'rejected')
       RETURNING id, status`
    );
    
    console.log(`\n✅ Eliminadas ${deleteResult.rows.length} batallas completadas/rechazadas:`);
    deleteResult.rows.forEach(b => {
      console.log(`  - Batalla ID ${b.id} (${b.status})`);
    });
    
    // Mostrar batallas restantes
    const remainingResult = await pool.query(
      `SELECT id, status, created_at
       FROM battle_challenges 
       ORDER BY id DESC`
    );
    
    console.log(`\n📋 Batallas restantes: ${remainingResult.rows.length}`);
    remainingResult.rows.forEach(battle => {
      console.log(`  ID: ${battle.id} | Status: ${battle.status} | Creada: ${battle.created_at}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanupCompletedBattles();
