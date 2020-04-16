const cors = require("cors");
const express = require("express");
const {ApolloServer} = require("apollo-server-express");
const {SubscriptionServer} = require("subscriptions-transport-ws");
const {execute, subscribe} = require("graphql");

if(process.env.NODE_ENV !== 'production') require('dotenv').config({path:'./.env'});

const DB_URL  = process.env.MONGODB_URI;
const mongoose = require("mongoose");
const {GraphQLJSON} = require("graphql-type-json");
const {createServer} = require("http");
const {errorQueries} = require("./mongoose/error");
const {userQueries} = require("./mongoose/user");
const {authGateway} = require("./utils");

const apiRoot = authGateway({
    ...userQueries,
    ...errorQueries
});

const schema = new ApolloServer({
    typeDefs: require("./schema"),
    resolvers: {
        JSON: GraphQLJSON
    },
    rootValue: apiRoot
});

// Attempt to connect to the DB

console.log(DB_URL);
mongoose.set("useNewUrlParser", true);
mongoose.set("useUnifiedTopology", true);
mongoose.connect(DB_URL);

//TODO: handle connection errors.
// mongoose.connect(DB_URL);
mongoose.connection.on("error", error => {
    console.error(error);
    process.exit(1);
});

const PORT = process.env.API_PORT || 4000;
const server = express();
//TODO: Don't forget to add your domain names and the ports in your env file to the whitelist so you don't run into cors issues
const whitelist = Object.freeze([
    "http://localhost:4000"
]);
const corsOptions  = {
    origin: function (origin, callback) {
        if (whitelist.indexOf(origin) !== -1 || !origin) {
            callback(null, true)
        } else {
            callback(new Error("Not Allowed by CORS"))
        }
    }
};

server.use("*", cors(corsOptions));
schema.applyMiddleware({app: server});

const ws = createServer(server);
ws.listen(PORT, () => {
    console.log(`GraphQL Server is now running on http://localhost:${PORT}`);
    console.log(`GraphQL Server is now running on http://localhost:${PORT}/graphql`);
    new SubscriptionServer({
        rootValue: apiRoot,
        schema: schema,
        execute,
        subscribe,
        onConnect: (connectionParameters, webSocket) => {
            if (connectionParameters && connectionParameters.authorization) {
                return {
                    headers: {
                        authorization: connectionParameters.authorization
                    }
                };
            } else {
                throw new CustomError("Subscriptions: user is not authorized", 403);
            }
        }
    }, {
        server: ws,
        path: "/subscriptions"
    });
});
