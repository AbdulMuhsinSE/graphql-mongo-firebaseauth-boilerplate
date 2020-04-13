const admin = require("firebase-admin");
const serviceAccount = require("./credentials/firebase-sdk-private-key.json");
const { Errors } = require("./mongoose/db");

class CustomError extends Error {
    /**
     * @param msg: string
     * @param code: Number
     */
    constructor(msg, code, errObj) {
        super(msg);
        this.message = msg;
        this.code = code;
        this.errObj = errObj;
    }
}

function setToArray(set) {
    return Object.keys(set).map(k => set[k]);
}

function prepare(data) {
    data.id = data._id.toString();
    delete data._id;
    return data;
}

function createDBRecord(model, data, mongoose) {
    return new Promise((resolve, reject) => {
       const newRecord = new model(data);
       newRecord._id = mongoose.Types.ObjectId();
       newRecord.save((error, result) => {
           if(error) {
               console.log(error);
           } else {
               resolve(prepare(result))
           }
       })
    });
}

function createManyDBRecords(model, data, mongoose) {
    /**
     * @param {Model} model
     * @param {*} data
     * @param {*} mongoose
     */

    return new Promise((resolve, reject) => {
        data = data.map(one => {
            one._id = mongoose.Types.ObjectId();
            return one;
        });
        model.insertMany(data, (error, docs) => {
            if (error) {
                console.log(error);
                reject(error);
            } else {
                resolve(docs.map(doc => prepare(doc)));
            }
        });
    });
}

function checkNoAuthRequired(functionPointer) {
    return functionPointer.name.includes("NoAuth");
}

function handleErrors(error) {
    if (error instanceof CustomError) {
        Errors.create({
            error: error.errObj,
            errorString: error.message,
            code: error.code ? error.code.toString() : "noCode",
            timeStamp: moment().unix(),
            timeFormatted: moment().format("dddd, D MMMM YYYY, hh:mm A UTCZ")
        });
        throw error;
    } else {
        console.log(error);
        Errors.create({
            error: error,
            errorString: error.toString(),
            code: "500",
            timeStamp: moment().unix(),
            timeFormatted: moment().format("dddd, D MMMM YYYY, hh:mm A UTCZ")
        });
        throw new Error("Internal Server Error");
    }
}

/**
 * This section adds firebase authorization to
 * all API endpoints which doesn't include "NoAuth"
 * in the function definition.
 * In the same way we will add specific role access
 * such that a user can access specific resources
 * if they hold a certain role based on the
 * function definition.
 *
 * NOTE: this functionality is an internal implementation
 * and changing it doesn't affect public facing
 * API, but require to change to it's binding object.
 *
 * Roles are described by using the following syntax:-
 * functionName + Role + [userRole]
 * ex: updateUserRoleAdmin => would be a function that requires a role of admin to be used
 * getItemsNoAuth => would be a function that requires no authentication roles
 * getUsers => would be an example of a function that requires general auth regardless of role
 */
function authGateway(apiRoot) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://[project-url].firebaseio.com" //database url from your firebase console
    });

    Object.keys(apiRoot).forEach(key => {
        const noAuth = checkNoAuthRequired(apiRoot[key]);
        const oldFunction = apiRoot[key];

        apiRoot[key] = (obj, context, info) => {
            if(noAuth && (!context || !context.headers || !context.headers.authorization)) {
                try { return oldFunction(obj); }
                catch (err) { handleErrors(err) }
            }

            if(context.headers.authorization) {
                const token = context.headers.authorization.split(" ")[1];
                return admin.auth().verifyIdToken(token, true)
                    .then( async decodedToken => {
                        const user = await admin.auth().getUser(decodedToken.uid);

                        if(oldFunction.name.includes("Role")) {
                            const role = oldFunction.name.split("Role")[1].toLowerCase();
                            if(user.customClaims && user.customClaims[role]) {
                                return oldFunction(obj, user);
                            } else {
                                handleErrors(new CustomError("Unauthorized Access", 403));
                            }
                        } else {
                            return oldFunction(obj, user);
                        }
                    })
                    .catch(err => {
                       if(noAuth) {
                           handleErrors(err);
                           return oldFunction(obj);
                       }
                       handleErrors(err);
                       //TODO: You might want to add a proper logging mechanisim here
                    });
            }

            handleErrors(new CustomError("Unauthorized Access", 403))
        }
    });
    return apiRoot;
}

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

module.exports = {
    createDBRecord: createDBRecord,
    createManyDBRecords: createManyDBRecords,
    asyncForEach: asyncForEach,
    authGateway: authGateway,
    prepare: prepare,
    admin: admin,
    CustomError: CustomError,
    handleErrors
};
