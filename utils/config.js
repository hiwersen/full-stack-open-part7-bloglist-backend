require('dotenv').config()

const JWT_SECRET = process.env.JWT_SECRET

const MONGODB_URI = process.env.NODE_ENV === 'test'
    ? process.env.TEST_MONGODB_URI
    : process.env.MONGODB_URI

const PORT = process.env.PORT || 3003

const config = {
    JWT_SECRET,
    MONGODB_URI,
    PORT
}

module.exports = config

