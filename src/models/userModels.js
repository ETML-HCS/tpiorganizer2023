const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    role: String,
    quota: [
      {
        expertise: Number,
        boss: Number,
      }
    ]
  },
  { collection: "tpiUsers" }
);

const User = mongoose.model("User", userSchema);

module.exports = User;
