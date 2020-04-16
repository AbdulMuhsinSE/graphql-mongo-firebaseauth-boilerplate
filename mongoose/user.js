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
    /*
    The reasoning behind creating the firebase user on the front end and only sending the
    user object to the backend, is to eliminate the need for password management and
    password on our part.
     */
    user._id = user.uid;
    user.role = userRole;
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

async function createUserNoAuth({user}, authUser) {
    user._id = user.uid;
    user.role = "user-role";
    delete user.uid;

    try {
        const newUser = new User(user);
        const customUserClaims = {};
        customUserClaims[user.role] = true;
        await admin.auth().setCustomUserClaims(user._id, customUserClaims);
        return newUser.save();
    } catch (err) {
        throw new CustomError("Something Went Wrong", 500, err)
    }
}

async function createUserTestNoAuth(authUser) {
    try {
        let userRecord = await admin.auth().createUser({
            email: 'user@example.com',
            emailVerified: false,
            phoneNumber: '+11234567890',
            password: 'secretPassword',
            displayName: 'John Doe',
            photoURL: 'http://www.example.com/12345678/photo.png',
            disabled: false
        });

        let newUser = new User({
            firstName: "John",
            lastName: "Doe",
            email: "user@example.com",
            _id: userRecord.uid,
            role: "user-role",
            phone: '+11234567890'
        });

        return newUser.save()
    } catch (err) {
        console.log(err);
        throw new CustomError("Something Went Wrong", 500, err)

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
        createUser: createUserNoAuth,
        createUserTest: createUserTestNoAuth,
        users: getUsersRoleAdmin,
        user: getUser,
        userByEmail: getUserByEmail,
        updateUser: updateUser,
    }
};
