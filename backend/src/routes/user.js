// The user controller exports an Express router. Re-export it directly so
// app.js can mount it at /api/users.
const usersRouter = require('../controllers/UserController');

module.exports = usersRouter;
