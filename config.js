require("dotenv").config();
module.exports = {
    port: process.env.PORT,
    db: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    },
    google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackUrl: process.env.CALLBACK_URL
    },
    session_Key: process.env.SECRET_KEY
}