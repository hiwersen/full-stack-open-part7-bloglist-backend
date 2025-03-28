const { test, describe, beforeEach, after } = require('node:test')
const assert = require('node:assert')

const supertest = require('supertest')
const app = require('../app')
const api = supertest(app)

const mongoose = require('mongoose')
const User = require('../models/user')
const logger = require('../utils/logger')

const users = [
    {
        username: "root",
        passwordHash: "$2a$10$d/wscoSXLR/lDpiqUb9.uOSiTgRfsGZ3UDCcP0Peg97AEjTBQn0yu"
    }
]

beforeEach(async () => {
    await User.deleteMany()
    await User.insertMany(users)
})

describe('GET /api/users', () => {

    describe('valid request', () => {

        test(`is safe`, async () => {
            const before = await User.find({})
            await api.get('/api/users')
            const after = await User.find({})
            assert.deepStrictEqual(after, before)
        })

        test(`is idempotent`, async () => {
            const first = await api.get('/api/users')
            const second = await api.get('/api/users')
            assert.deepStrictEqual(second.body, first.body)
        })

        describe(`response should include:`, () => {

            test(`${users.length} user(s)`, async () => {
                const actual = await api.get('/api/users')
                assert(actual.body.length, users.length)
            })

            test(`status code "200 OK"`, async () => {
                await api.get('/api/users').expect(200)
            })

            test(`json format`, async () => {
                await api.get('/api/users').expect('Content-Type', /application\/json/)
            })

            test(`each user a "username"`, async () => {
                const { body } = await api.get('/api/users')
                assert(body.every(user => Object.keys(user).includes("username")))
            })

            test(`each user an "id"`, async () => {
                const { body } = await api.get('/api/users')
                assert(body.every(user => Object.keys(user).includes("id")))
            })
        })

        describe(`response should not include:`, () => {

            test(`each user a "password"`, async () => {
                const { body } = await api.get('/api/users')
                assert(!body.some(user => Object.keys(user).includes("password")))
            })

            test(`each user a "passwordHash"`, async () => {
                const { body } = await api.get('/api/users')
                assert(!body.some(user => Object.keys(user).includes("passwordHash")))
            })
        })
    })
})

describe('POST /api/users', () => {

    describe('valid users', () => {

        const validUsers = [
            {
                description: 'user contains name',
                user: {
                    username: 'johndoe',
                    password: 'secure_password',
                    name: 'John Doe'
                }
            },
            {
                description: 'user does not contain name',
                user: {
                    username: 'johndoe',
                    password: 'secure_password'
                }
            }
        ]

        validUsers.forEach(({ description, user }) => {

            describe(`when ${description}`, () => {

                describe(`database:`, () => {

                    test(`should increase total users by one`, async () => {
                        const before = await User.countDocuments({})
                        await api.post('/api/users').send(user)
                        const after = await User.countDocuments({})
                        assert.strictEqual(after, before + 1)
                    })

                    test(`should save user's content`, async () => {
                        await api.post('/api/users').send(user)
                        const result = await User.findOne({ username: user.username })
                        assert(result)
                    })

                    test(`should contain only one ${user.username}`, async () => {
                        await api.post('/api/users').send(user)
                        const result = await User.find({ username: user.username }, 'username')
                        assert(result && result.length === 1 && result[0].username === user.username)
                    })

                })

                describe(`response should include:`, () => {

                    test(`status code "201 Created"`, async () => {
                        await api.post('/api/users').send(user).expect(201)
                    })

                    test(`json format`, async () => {
                        await api.post('/api/users').send(user).expect('Content-Type', /application\/json/)
                    })

                    test(`"username"`, async () => {
                        const { body } = await api.post('/api/users').send(user)
                        assert(Object.keys(body).includes("username"))
                    })

                    test(`"id"`, async () => {
                        const { body } = await api.post('/api/users').send(user)
                        assert(Object.keys(body).includes("id"))
                    })
                })

                describe(`response should not include:`, () => {

                    test(`"passwordHash"`, async () => {
                        const { body } = await api.post('/api/users').send(user)
                        assert(!Object.keys(body).includes("passwordHash"))
                    })

                    test(`"password"`, async () => {
                        const { body } = await api.post('/api/users').send(user)
                        assert(!Object.keys(body).includes("password"))
                    })
                })
            })
        })
    })


    describe('invalid users', () => {

        const invalidUsers = [
            {
                description: "missing password",
                user: {
                    username: "johndoe",
                    name: "John Doe"
                }
            },
            {
                description: "short password",
                user: {
                    username: "johndoe",
                    password: "se",
                    name: "John Doe"
                }
            },
            {
                description: "password is not String",
                user: {
                    username: "johndoe",
                    password: null,
                    name: "John Doe"
                }
            },
            {
                description: "missing username",
                user: {
                    password: "secure_password",
                    name: "John Doe"
                }
            },
            {
                description: "short username",
                user: {
                    username: "jo",
                    password: "secure_password",
                    name: "John Doe"
                }
            },
            {
                description: "non-unique username",
                user: {
                    username: "root",
                    password: "secure_password",
                    name: "John Doe"
                }
            }
        ]

        invalidUsers.forEach(({ description, user }) => {

            describe(`when ${description}`, () => {

                test(`should not save user's content to database`, async () => {
                    const before = await User.find({})
                    await api.post('/api/users').send(user)
                    const after = await User.find({})
                    assert.deepStrictEqual(after, before)
                })

                describe(`response should include:`, () => {

                    test(`status code "400 Bad Request"`, async () => {
                        await api.post('/api/users').send(user).expect(400)
                    })

                    test(`json format`, async () => {
                        await api.post('/api/users').send(user).expect('Content-Type', /application\/json/)
                    })
    
                    test(`error message`, async () => {
                        const { body } = await api.post('/api/users').send(user)
                        assert(body.error)
                    })

                    test(`error message, only`, async () => {
                        const { body } = await api.post('/api/users').send(user)
                        assert(Object.keys(body).every(key => key === 'error'))
                    })
                })
            })
        })
    })
})

after(async () => {
    await mongoose.connection.close()
    logger.info('Connection to MongoDB closed')
})