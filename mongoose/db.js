const mongoose = require("mongoose");
const moment = require("moment");

const ErrorsSchema = new mongoose.Schema({
    error: Object,
    errorString: String,
    code: String,
    timeStamp: Number,
    //NOTE: This is for reading directly from mongo shell
    timeFormatted: String
});

const UserSchema = new mongoose.Schema({
    _id: String, // Firebase UID
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    role: String,
});

module.exports = {
    Errors: mongoose.model("errors", ErrorsSchema),
    User: mongoose.model("users", UserSchema),
    mongoose
};

