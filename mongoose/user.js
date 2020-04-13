const { User, mongoose, Company } = require('./db');
const { createDBRecord, admin, CustomError } = require('../utils');

async function updateUser({newUserData}, authUser) {
    if (newUserData.uid === authUser.uid) {
        await User.findByIdAndUpdate(newUserData.uid, {
            firstName: newUserData.firstName,
            lastName: newUserData.lastName,
            phone: newUserData.phone
        }, (err) => {
            if (err) {
                throw new CustomError("Failed to Update User", 500, err)
            } else {
                console.log("Update the User");
            }
        });
        return await User.findById(newUserData.uid).exec();
    } else {
        throw new CustomError("Unauthorized Access", 403);
    }
}

async function createUserRoleAdmin({user, userRole}, authUser) {
    user._id = user.uid;
    user.role = "userRole";
    delete user.uid;

    try {
        const newUser = new User(user);
        const customUserClaims = {};
        customUserClaims[userRole] = true;
        await admin.auth().setCustomUserClaims(user._id, customUserClaims);
        return newUser.save();
    } catch (err) {
        throw new CustomError("Unauthorized Access", 403, err)
    }
}

function getUsersRoleAdmin(args, authUser) {
    return User.find();
}

function getUser({id}, authUser) {
    if (id === authUser.uid) {
        return User.findById(id)
    }
    throw new CustomError("Unauthorized Access", 403)
}

async function getUserByEmail({email}, authUser) {
    const user = await User.findOne({email: email}).exec();
    if (user._id === authUser.uid) {
        return user;
    }
    throw new CustomError("Unauthorized Access", 403);
}

module.exports = {
    userQueries: {
        createUser: createUserRoleAdmin,
        users: getUsersRoleAdmin,
        user: getUser,
        userByEmail: getUserByEmail,
        updateUser: updateUser,
    }
};
