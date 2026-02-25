const db = require('./lib/db');

async function resetBattle() {
  try {
    // Eliminar batalla en mal estado
    const result = await db.pool.query(
      `DELETE FROM battle_challenges WHERE id = 8`
    );
    
    console.log(`✅ Batalla ID 8 eliminada: ${result.rowCount} fila(s)`);
    
    // Mostrar batallas restantes
    const battles = await db.pool.query(
      `SELECT id, status, challenger_id, opponent_id FROM battle_challenges ORDER BY id`
    );
    
    console.log('\n📊 Batallas actuales:');
    battles.rows.forEach(b => {
      console.log(`  ID ${b.id}: Estado ${b.status}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

resetBattle();
