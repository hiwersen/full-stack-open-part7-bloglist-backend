const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const config = require('../utils/config')
const User = require('../models/user')
const loginRouter = require('express').Router()

loginRouter.post('/', async (request, response, next) => {
    const { username, password } = request.body

    const user = await User.findOne({ username })

    if (!user) {
        const error = new Error('invalid username')
        error.name = 'AuthenticationError'
        return next(error)
    } 

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash)

    if (!isPasswordValid) {
        const error = new Error('invalid password')
        error.name = 'AuthenticationError'
        return next(error)
    }

    const tokenUser = { username: user.username, id: user._id }

    const token = jwt.sign(tokenUser, config.JWT_SECRET, { expiresIn: 60 * 15 })

    response.json({ token, username: user.username, name: user.name })
})

module.exports = loginRouter