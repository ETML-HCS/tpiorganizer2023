const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  login:{
    type:String,
    unique:true,
    require:true
  },
  email: {
    type: String,
    unique: true,
  },
  phone: String,
  password: {
    type: String,
    required: true,
  },
  role: String,
  quota: [
    {
      expertise: Number,
      boss: Number,
    },
  ],
}, { collection: "tpiUsers" });

const User = mongoose.model("User", userSchema);

module.exports = User;
