const bcrypt = require("bcrypt");

const myPlaintextPassword = "12345"; // The password you want to encrypt

bcrypt.hash(myPlaintextPassword, 10, function (err, hash) {
  console.log("Your Hashed Password is:");
  console.log(hash);
});
