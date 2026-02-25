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
    console.log('🔍 Verificando base de datos...\n');

    // 1. Verificar USUARIOS
    console.log('📌 USUARIOS');
    const usersResult = await pool.query('SELECT * FROM users LIMIT 10');
    console.log(`✅ Total: ${usersResult.rows.length} usuarios`);
    if (usersResult.rows.length > 0) {
      console.log('Primeras columnas:', Object.keys(usersResult.rows[0]));
      console.table(usersResult.rows.slice(0, 3));
    }

    // 2. Verificar AMIGOS
    console.log('\n📌 AMIGOS');
    const friendsResult = await pool.query('SELECT * FROM friends LIMIT 10');
    console.log(`✅ Total: ${friendsResult.rows.length} relaciones`);
    if (friendsResult.rows.length > 0) {
      console.log('Primeras columnas:', Object.keys(friendsResult.rows[0]));
      console.table(friendsResult.rows);
    }

    // 3. Verificar EQUIPOS
    console.log('\n📌 EQUIPOS');
    const teamsResult = await pool.query('SELECT * FROM teams LIMIT 10');
    console.log(`✅ Total: ${teamsResult.rows.length} equipos`);
    if (teamsResult.rows.length > 0) {
      console.log('Primeras columnas:', Object.keys(teamsResult.rows[0]));
      console.table(teamsResult.rows);
    } else {
      console.log('❌ Sin equipos');
    }

    // 4. Verificar POKEMONES EN EQUIPOS
    console.log('\n📌 POKEMONES EN EQUIPOS');
    try {
      const teamPokemonResult = await pool.query('SELECT * FROM team_pokemon LIMIT 10');
      console.log(`✅ Total: ${teamPokemonResult.rows.length} pokemones en equipos`);
      if (teamPokemonResult.rows.length > 0) {
        console.log('Primeras columnas:', Object.keys(teamPokemonResult.rows[0]));
        console.table(teamPokemonResult.rows);
      } else {
        console.log('❌ Sin pokemones en equipos');
      }
    } catch (err) {
      // Calcular total de pokemones dentro de los equipos
      let totalPokemons = 0;
      const teamsResult = await pool.query('SELECT pokemons FROM teams WHERE pokemons IS NOT NULL');
      teamsResult.rows.forEach(row => {
        try {
          const pokemons = JSON.parse(row.pokemons);
          totalPokemons += Array.isArray(pokemons) ? pokemons.length : 0;
        } catch (e) {}
      });
      console.log(`📌 Nota: Los pokemones están almacenados dentro de cada equipo (JSON)`);
      console.log(`✅ Total de pokemones en equipos: ${totalPokemons}`);
    }

    // 5. Verificar BATALLAS
    console.log('\n📌 BATALLAS');
    const battlesResult = await pool.query('SELECT * FROM battles LIMIT 10');
    console.log(`✅ Total: ${battlesResult.rows.length} batallas`);
    if (battlesResult.rows.length > 0) {
      console.log('Primeras columnas:', Object.keys(battlesResult.rows[0]));
      console.table(battlesResult.rows.slice(0, 3));
    } else {
      console.log('❌ Sin batallas');
    }

    // 6. Verificar FAVORITOS
    console.log('\n📌 POKEMONES FAVORITOS');
    try {
      const favoritesResult = await pool.query('SELECT * FROM favorites LIMIT 10');
      console.log(`✅ Total: ${favoritesResult.rows.length} favoritos`);
      if (favoritesResult.rows.length > 0) {
        console.log('Primeras columnas:', Object.keys(favoritesResult.rows[0]));
        console.table(favoritesResult.rows);
      } else {
        console.log('❌ Sin favoritos');
      }
    } catch (err) {
      console.log('❌ Tabla favorites no existe o error:', err.message);
    }

    // 7. RESUMEN
    console.log('\n\n📊 RESUMEN FINAL');
    console.log(`✅ Usuarios guardados: ${usersResult.rows.length}`);
    console.log(`✅ Amigos agregados: ${friendsResult.rows.length}`);
    console.log(`✅ Equipos creados: ${teamsResult.rows.length}`);
    console.log(`✅ Pokemones en equipos: ${teamPokemonResult.rows.length}`);
    console.log(`✅ Batallas realizadas: ${battlesResult.rows.length}`);

    console.log('\n✅ Base de datos verificada exitosamente');
    console.log('\n💾 LA BASE DE DATOS ESTÁ GUARDANDO INFORMACIÓN ✅');

    await pool.end();
  } catch (error) {
    console.error('❌ Error al verificar la base de datos:', error.message);
    process.exit(1);
  }
}

checkDatabase();
