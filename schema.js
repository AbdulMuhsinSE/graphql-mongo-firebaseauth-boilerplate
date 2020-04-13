const fs = require('fs');
module.exports = fs.readFileSync('./api.graphql', {encoding: 'utf8'});
