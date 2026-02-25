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
    console.log('\n🔍📊 VERIFICACIÓN DE BASE DE DATOS - RESUMEN\n');

    // Usuarios
    const users = await pool.query('SELECT COUNT(*) FROM users');
    const userCount = users.rows[0].count;

    // Amigos
    const friends = await pool.query('SELECT COUNT(*) FROM friends');
    const friendCount = friends.rows[0].count;

    // Equipos
    const teams = await pool.query('SELECT COUNT(*) FROM teams');
    const teamCount = teams.rows[0].count;

    // Pokemones en equipos
    let totalPokemons = 0;
    const teamsData = await pool.query('SELECT pokemons FROM teams WHERE pokemons IS NOT NULL');
    teamsData.rows.forEach(row => {
      try {
        const pokemons = JSON.parse(row.pokemons);
        totalPokemons += Array.isArray(pokemons) ? pokemons.length : 0;
      } catch (e) {}
    });

    // Batallas
    try {
      const battles = await pool.query('SELECT COUNT(*) FROM battles');
      const battleCount = battles.rows[0].count;
      console.log('📊 DATOS GUARDADOS EN LA BASE DE DATOS:\n');
      console.log(`✅ Usuarios registrados: ${userCount}`);
      console.log(`✅ Amigos agregados: ${friendCount}`);
      console.log(`✅ Equipos creados: ${teamCount}`);
      console.log(`✅ Pokemones en equipos: ${totalPokemons}`);
      console.log(`✅ Batallas realizadas: ${battleCount}`);
    } catch (err) {
      console.log('📊 DATOS GUARDADOS EN LA BASE DE DATOS:\n');
      console.log(`✅ Usuarios registrados: ${userCount}`);
      console.log(`✅ Amigos agregados: ${friendCount}`);
      console.log(`✅ Equipos creados: ${teamCount}`);
      console.log(`✅ Pokemones en equipos: ${totalPokemons}`);
      console.log(`✅ Batallas realizadas: (tabla no disponible)`);
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ ¡LA BASE DE DATOS ESTÁ GUARDANDO INFORMACIÓN!');
    console.log('='.repeat(50) + '\n');

    // Mostrar usuarios de ejemplo
    console.log('📄 Usuarios en la base de datos:');
    const usersList = await pool.query('SELECT email, name, code FROM users LIMIT 5');
    usersList.rows.forEach((user, i) => {
      console.log(`   ${i+1}. ${user.email} (${user.name}) - Código: ${user.code}`);
    });

    // Mostrar equipos de ejemplo
    console.log('\n🛡️ Equipos en la base de datos:');
    const teamsList = await pool.query('SELECT team_name, user_id FROM teams LIMIT 5');
    teamsList.rows.forEach((team, i) => {
      console.log(`   ${i+1}. "${team.team_name}" (Usuario ID: ${team.user_id})`);
    });

    console.log('\n✅ Verificación completada correctamente\n');
    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();
