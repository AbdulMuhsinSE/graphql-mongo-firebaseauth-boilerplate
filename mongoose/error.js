const {Errors} = require("./db.js");

module.exports = {
    errorQueries: {
        allErrors: getErrorsNoAuth
    }
};

function getErrorsNoAuth() {
    return Errors.find().exec();
}
