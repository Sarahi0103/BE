const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

async function readDB(){
  try{
    const txt = await fs.readFile(DB_PATH, 'utf8');
    return JSON.parse(txt);
  }catch(e){
    return { users: [] };
  }
}

async function writeDB(db){
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

async function getUserByEmail(email){
  const db = await readDB();
  return db.users.find(u => u.email === email);
}

async function createUser(user){
  const db = await readDB();
  db.users.push(user);
  await writeDB(db);
  return user;
}

async function updateUser(email, patch){
  const db = await readDB();
  const idx = db.users.findIndex(u => u.email === email);
  if(idx === -1) return null;
  db.users[idx] = Object.assign({}, db.users[idx], patch);
  await writeDB(db);
  return db.users[idx];
}

module.exports = { readDB, writeDB, getUserByEmail, createUser, updateUser };
