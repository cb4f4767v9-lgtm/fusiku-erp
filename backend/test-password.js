const bcrypt = require('bcrypt');

// 🔴 paste password hash from database here
const hash = "PASTE_HASH_FROM_DB_HERE";

// 🔴 change this to password you want to test
const password = "admin123";

bcrypt.compare(password, hash).then(result => {
  console.log("Match:", result);
});