require("dotenv").config();
module.exports = {
    port: process.env.port,
    db: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    }
}