const { test, describe, beforeEach, after, afterEach } = require('node:test')
const assert = require('node:assert')

const supertest = require('supertest')
const app = require('../app')
const api = supertest(app)

const Blog = require('../models/blog')
const User = require('../models/user')
const mongoose = require('mongoose')
const logger = require('../utils/logger')

const path = '/api/blogs'

let blogId, token, invalidToken

const user = { username: 'root', password: 'secure_password' }
const invalidUser = { username: 'willdelete', password: 'unsafe' }

const blogs = [
    {
      title: "React patterns",
      author: "Michael Chan",
      url: "https://reactpatterns.com/",
      likes: 7
    },
    {
      title: "Go To Statement Considered Harmful",
      author: "Edsger W. Dijkstra",
      url: "http://www.u.arizona.edu/~rubinson/copyright_violations/Go_To_Considered_Harmful.html",
      likes: 5
    },
    {
      title: "Canonical string reduction",
      author: "Edsger W. Dijkstra",
      url: "http://www.cs.utexas.edu/~EWD/transcriptions/EWD08xx/EWD808.html",
      likes: 12
    },
    {
      title: "First class tests",
      author: "Robert C. Martin",
      url: "http://blog.cleancoder.com/uncle-bob/2017/05/05/TestDefinitions.htmll",
      likes: 10
    },
    {
      title: "TDD harms architecture",
      author: "Robert C. Martin",
      url: "http://blog.cleancoder.com/uncle-bob/2017/03/03/TDD-Harms-Architecture.html",
      likes: 0
    },
    {
      title: "Type wars",
      author: "Robert C. Martin",
      url: "http://blog.cleancoder.com/uncle-bob/2016/05/01/TypeWars.html",
      likes: 2
    }  
  ]

  const validBlog = {
    author: "John Doe",
    title: 'Hello, World!',
    url: 'https://example.com',
    likes: 75
}

const unauthorizedUser = () => ({
    description: `unauthorized user`,
    id: blogId,                             // Dynamic: needs update
    token,                                  // Dynamic: needs update
    status: [403, "403 Forbidden"],
    error: true
})

const invalidTokens = () => [
    {
        description: `missing token`,
        token: null,
        status: [401, "401 Unauthorized"],
        error: true
    },
    {
        description: `invalid token`,
        token: 'xxxxxxxxxxxxxxxxxxxxx',
        status: [401, "401 Unauthorized"],
        error: true
    },
    {
        description: `invalid user`,
        token: invalidToken,                // Dynamic: needs update
        status: [401, "401 Unauthorized"],
        error: true
    }
]

const invalidIds = () => [
    {
        description: 'non-existing id',
        id: '67a493f358a23e48a12f5030',
        status: [404, "404 Not Found"],
        error: false
    },
    {
        description: 'malformed id',
        id: 'xxxxxxxxxxxxxxxxxxxxxxxx',
        status: [400, "400 Bad Request"],
        error: true
    },
    {
        description: 'empty id',
        id: '',
        status: [404, "404 Not Found"], // either 'unknown endpoint' or another route
        error: true
    }
]

beforeEach(async () => {
    await Blog.deleteMany({})
    await Blog.insertMany(blogs)

    const blog = await Blog.findOne({})
    blogId = blog._id.toString()
    // logger.info('blogId: --------------------------', blogId)

    const blogsCount = await Blog.countDocuments()
    // logger.info('blogs before tests ------:', blogsCount)

    await User.deleteMany({})

    await api.post('/api/users').send(user)
    const auth = await api.post('/api/login').send(user)
    token = auth.body.token

    await api.post('/api/users').send(invalidUser)
    const invalidAuth = await api.post('/api/login').send(invalidUser)
    invalidToken = invalidAuth.body.token
    await User.findOneAndDelete({ username: 'willdelete' })

    const usersCount = await User.countDocuments()
    // logger.info('users before tests ------:', usersCount)
})

describe('GET /api/blogs', () => {

    describe(`a valid request`, () => {

        test(`is safe`, async () => {
            const before = await Blog.find({})
            await api.get(path)
            const after = await Blog.find({})
            assert.deepStrictEqual(after, before)
        })

        test(`is idempotent`, async () => {
            const first = await api.get(path)
            const second = await api.get(path)
            assert.deepStrictEqual(second.body, first.body)
        })

        describe(`response should include`, () => {

            test(`${blogs.length} blog posts`, async () => {
                const actual = await api.get(path)
                assert(actual.body.length, blogs.length)
            })
        
            test(`status code "200 OK"`, async () => {
                await api.get(path).expect(200)
            })
        
            test(`json format`, async () => {
                await api.get(path).expect('Content-Type', /application\/json/)
            })
        
            test(`each blog an "id", "title" and "url"`, async () => {
                const { body: result } = await api.get(path)
                assert(result.every(blog => Object.keys(blog).includes('id')))
                assert(result.every(blog => Object.keys(blog).includes('title')))
                assert(result.every(blog => Object.keys(blog).includes('url')))
            })
        })
    })
})

describe('GET /api/blogs/:id', () => {

    describe(`valid request`, () => {

        test(`is safe`, async () => {
            const before = await Blog.find({})
            await api.get(`${path}/${blogId}`)
            const after = await Blog.find({})
            assert.deepStrictEqual(after, before)
        })

        test(`is idempotent`, async () => {
            const first = await api.get(`${path}/${blogId}`)
            const second = await api.get(`${path}/${blogId}`)
            assert.deepStrictEqual(second.body, first.body)
        })

        describe(`response should include`, () => {
        
            test(`status code "200 OK"`, async () => {
               await api.get(`${path}/${blogId}`).expect(200)
            })
        
            test(`json format`, async () => {
                await api.get(`${path}/${blogId}`).expect('Content-Type', /application\/json/)
            })
        
            test(`"id", "title" and "url"`, async () => {
                const { body: blog } = await api.get(`${path}/${blogId}`)
                assert(Object.keys(blog).includes('id'))
                assert(Object.keys(blog).includes('title'))
                assert(Object.keys(blog).includes('url'))
            })
        })
    })

    describe('invalid requests', () => {

        invalidIds()
        .filter(request => request.description !== 'empty id')
        .forEach(({ description, id, status, error }) => {

            describe(`when ${description}`, () => {

                describe(`database:`, () => {

                    test(`should not be changed`, async () => {
                        const before = await Blog.find({})
                        await api.get(`${path}/${id}`)
                        const after = await Blog.find({})
                        assert.deepStrictEqual(after, before)
                    })
                })

                describe(`response`, () => {

                    test(`should include status code ${status[1]}`, async () => {
                        await api.get(`${path}/${id}`).expect(status[0])
                    })
    
                    test(`should ${ error ? '' : 'not ' }include error message`, async () => {
                        const { body } = await api.get(`${path}/${id}`)
                        assert.equal(!!body.error, error)
                    })
                })
            })
        })
    })
})

describe('POST /api/blogs', async () => {

    describe('valid request', () => {

        describe(`database:`, () => {

            test(`should increase total blogs by one`, async () => {
                const before = await Blog.countDocuments({})
                await api.post(path).set('Authorization', `Bearer ${token}`).send(validBlog)
                const after = await Blog.countDocuments({})
                assert.strictEqual(after, before + 1)
            })
        
            test(`should save newBlog's content`, async () => {
                await api.post(path).set('Authorization', `Bearer ${token}`).send(validBlog)
                const result = await Blog.findOne(validBlog)
                assert(result)
            })
        })

        describe(`response should include`, () => {

            test(`status code "201 Created"`, async () => {
                await api.post(path).set('Authorization', `Bearer ${token}`).send(validBlog).expect(201)
            })
        
            test(`json format`, async () => {
                await api.post(path).set('Authorization', `Bearer ${token}`).send(validBlog).expect('Content-Type', /application\/json/)
            })

            test(`"id", "title", "url" and "user"`, async () => {
                const { body } = await api.post(path).set('Authorization', `Bearer ${token}`).send(validBlog)
                assert(Object.keys(body).includes('id'))
                assert(Object.keys(body).includes('title'))
                assert(Object.keys(body).includes('url'))
                assert(Object.keys(body).includes('user'))
            })
        })

        describe(`blog's creator (user):`, () => {

            test(`should save blog's id`, async () => {
                const { body } = await api.post(path).set('Authorization', `Bearer ${token}`).send(validBlog)
                const user = await User.findById(body.user)
                const blogId = body.id
                assert(user.blogs.map(b => b.toString()).includes(blogId))
            })
        })
    })

    describe('missing likes', () => {

        const noLikes = {
            author: "John Doe",
            title: 'Hello, World!',
            url: 'https://example.com'
        }

        test(`defaults to zero`, async () => {
            const { body: result } = await api.post(path).set('Authorization', `Bearer ${token}`).send(noLikes)
            assert.strictEqual(result.likes, 0)
        })
    })

    
    describe('invalid requests', async () => {

        const invalidRequests = (requests = []) => [
            {
                description: `missing "title"`,
                token,
                blog: {
                    author: "John Doe",
                    url: 'https://example.com',
                    likes: 75
                },
                status: [400, "400 Bad Request"]
            },
            {
                description: `missing "url"`,
                token,
                blog: {
                    author: "John Doe",
                    title: 'Hello, World!',
                    likes: 75
                },
                status: [400, "400 Bad Request"]
            }
        ].concat(requests)

        
        invalidRequests(invalidTokens())
            .forEach(({ description, token, blog, status }, i) => {

            describe(`when ${description}`, () => {
            
                test(`should not save blog's content to database`, async () => {
                    // Update authentication token's value after each async call
                    token = invalidRequests(invalidTokens())[i].token
                    
                    const before = await Blog.find({})
                    await api.post(path).set('Authorization', `Bearer ${token}`).send(blog)
                    const after = await Blog.find({})
                    assert.deepStrictEqual(before, after)
                })

                describe(`response should include`, () => {

                    test(`status code ${status[1]}`, async () => {
                        // Update authentication token's value after each async call
                        token = invalidRequests(invalidTokens())[i].token

                        await api.post(path).set('Authorization', `Bearer ${token}`).send(blog).expect(status[0])
                    })
                
                    test(`error message`, async () => {
                        // Update authentication token's value after each async call
                        token = invalidRequests(invalidTokens())[i].token
                        
                        const { body } = await api.post(path).set('Authorization', `Bearer ${token}`).send(blog)
                        assert(body.error)
                    })

                    test(`error message, only`, async () => {
                        // Update authentication token's value after each async call
                        token = invalidRequests(invalidTokens())[i].token
                        
                        const { body } = await api.post(path).set('Authorization', `Bearer ${token}`).send(blog)
                        assert(Object.keys(body).every(key => key === 'error'))
                    })
                })
            })
        })
    })
})

describe('DELETE /api/blogs/:id', () => {
    const postBlog = async () => {
        const { body: blog } = await api.post(path).set('Authorization', `Bearer ${token}`).send(validBlog)
        return blog
    }

    const deleteBlog = async (id, token) => {
        const { body } = await api.delete(`${path}/${id}`).set('Authorization', `Bearer ${token}`)
        return body
    }

    describe('valid request', () => {
        
        test(`is idempotent`, async () => {
            const blog = await postBlog()
            const first = await deleteBlog(blog.id, token)
            const before = Blog.find({})
            const second = await deleteBlog(blog.id, token)
            const after = Blog.find({})
            assert.deepStrictEqual(second, first)
            assert.deepStrictEqual(after, before)
        })


        describe(`database`, () => {

            test(`should decrease total blogs by one`, async () => {
                const blog = await postBlog()
                const before = await Blog.countDocuments({})
                await deleteBlog(blog.id, token)
                const after = await Blog.countDocuments({})
                assert.strictEqual(after, before - 1)
            })
    
            test(`should delete blog's content`, async () => {
                const blog = await postBlog()
                await deleteBlog(blog.id, token)
                const result = await Blog.findById(blog.id)
                assert(!result)
            })
        })

        describe(`response should include`, () => {

            test(`status code "204 No Content"`, async () => {
                const blog = await postBlog()
                await api.delete(`${path}/${blog.id}`).set('Authorization', `Bearer ${token}`).expect(204)
            })
        })

        describe(`response should not include`, () => {

            test(`body content`, async () => {
                const blog = await postBlog()
                const body = await deleteBlog(blog.id, token)
                assert.strictEqual(Object.entries(body).length, 0)
            })
        })

        describe(`blog's creator (user):`, () => {

            test(`should delete blog's id`, async () => {
                const blog = await postBlog()
                await deleteBlog(blog.id, token)

                let user = await User.findById(blog.user)
                assert(!user.blogs.map(b => b.toString()).includes(blog.id))
            })
        })
    })

    describe('invalid requests', () => {

        const invalidRequests = () => 
            invalidIds()
            .map(request => {
                request.token = token
                request.status = request.description === 'non-existing id' 
                    ? [204, "204 No Content"]
                    : request.status

                return request
            })
            .concat(invalidTokens())
            .concat(unauthorizedUser())


        invalidRequests()
            .forEach(({ description, id, token, status, error }, i) => {

            describe(`when ${description}`, () => {

                describe(`database:`, () => {

                    test(`should not be changed`, async () => {
                        // Update dynamic values after each async call
                        id = invalidRequests()[i].id
                        token = invalidRequests()[i].token

                        const before = await Blog.find({})
                        await deleteBlog(id, token)
                        const after = await Blog.find({})
                        assert.deepStrictEqual(after, before)
                    })
                })

                describe(`response:`, () => {

                    test(`should include status code ${status[1]}`, async () => {
                        // Update dynamic values after each async call
                        id = invalidRequests()[i].id
                        token = invalidRequests()[i].token

                        await api.delete(`${path}/${id}`).set('Authorization', `Bearer ${token}`).expect(status[0])
                    })
    
                    test(`should ${ error ? '' : 'not ' }include error message`, async () => {
                        // Update dynamic values after each async call
                        id = invalidRequests()[i].id
                        token = invalidRequests()[i].token

                        const body = await deleteBlog(id, token)
                        assert.equal(!!body.error, error)
                    })
                })
            })
        })
    })
})

describe('PUT /api/blogs/:id', () => {

    const postBlog = async () => {
        const { body: blog } = await api.post(path).set('Authorization', `Bearer ${token}`).send(validBlog)
        return blog
    }

    const updateBlog = async (id, token, update) => {
        const { body } = await api.put(`${path}/${id}`).set('Authorization', `Bearer ${token}`).send(update)
        return body
    }

    const validRequests = () => [
        {
            description: 'all fields',
            token,
            update: {
                title: "Updated Title",
                author: "Updated Author",
                url: "https://updated.com/",
                likes: 99,
              }
        },
        {
            description: '"title" only',
            token,
            update: {
                title: "Updated Title"
              }
        },
        {
            description: '"author" only',
            token,
            update: {
                author: "Updated Author"
              }
        },
        {
            description: '"url" only',
            token,
            update: {
                url: "https://updated.com/"
              }
        },
        {
            description: '"likes" only',
            token,
            update: {
                likes: 99
              }
        },
        {
            description: 'no fields',
            token,
            update: {}
        },
    ]

    const invalidRequests = () => 
        invalidIds()
        .map(request => ({ ...request, token }))
        .concat(invalidTokens())
        .concat(unauthorizedUser())
        .map(request => ({ ...request, update: {
            title: "Updated Title",
            author: "Updated Author",
            url: "https://updated.com/",
            likes: 99,
          }}))

    describe(`in all cases`, () => {
        
        const allRequests = () => validRequests().concat(invalidRequests())

        describe(`should not change total blogs`, () => {

            allRequests().forEach(({ description, token, update }, i) => {

                test(`when updating: ${description}`, async () => {
                    // Update dynamic values after each async call
                    token = allRequests()[i].token
                    
                    const blog = await postBlog()
                    const before = await Blog.countDocuments({})
                    await updateBlog(blog.id, token, update)
                    const after = await Blog.countDocuments({})
                    assert.strictEqual(after, before)
                })
            }) 
        })
    })

    describe('valid requests', () => {

        validRequests().forEach(({ description, token, update }, i) => {

            describe(`when ${description}`, () => {

                test(`is idempotent`, async () => {
                    const blog = await postBlog()
                    const first = await updateBlog(blog.id, token, update)
                    const before = Blog.find({})
                    const second = await updateBlog(blog.id, token, update)
                    const after = Blog.find({})
                    assert.deepStrictEqual(second, first)
                    assert.deepStrictEqual(after, before)
                })

                describe(`database:`, () => {

                    test(`should update blog's requested field(s)`, async () => {
                        // Update authentication token's value after each async call
                        token = validRequests()[i].token
                        const blog = await postBlog()
                        await updateBlog(blog.id, token, update)
                        const result = await Blog.findById(blog.id)
                        assert(Object.keys(update).every(key => update[key] === result[key]))
                    })
                })

                describe(`response should include:`, () => {

                    test(`status code "200 OK"`, async () => {
                        // Update authentication token's value after each async call
                        token = validRequests()[i].token
                        const blog = await postBlog()
                        await api.put(`${path}/${blog.id}`).set('Authorization', `Bearer ${token}`).send(update)
                            .expect(200)
                    })
    
                    test(`json format`, async () => {
                        // Update authentication token's value after each async call
                        token = validRequests()[i].token
                        const blog = await postBlog()
                        await api.put(`${path}/${blog.id}`).set('Authorization', `Bearer ${token}`).send(update)
                            .expect('Content-Type', /application\/json/)
                    })

                    test(`updated fields`, async () => {
                        // Update authentication token's value after each async call
                        token = validRequests()[i].token
                        const blog = await postBlog()
                        const body = await updateBlog(blog.id, token, update)
                        assert(Object.keys(update).every(key => Object.keys(body).includes(key)))
                    })
                })
            })
        })
    })

    describe('invalid requests', () => {

        invalidRequests().forEach(({ description, id, token, update, status, error }, i) => {

            describe(`when ${description}`, () => {

                describe(`database:`, () => {

                    test(`should not be changed`, async () => {
                        // Update dynamic values after each async call
                        id = invalidRequests()[i].id
                        token = invalidRequests()[i].token
                        const before = await Blog.find({})
                        await updateBlog(id, token, update)
                        const after = await Blog.find({})
                        assert.deepStrictEqual(after, before)
                    })
                })

                describe(`response:`, () => {

                    test(`should include status code ${status[1]}`, async () => {
                        // Update dynamic values after each async call
                        id = invalidRequests()[i].id
                        token = invalidRequests()[i].token
                        await api.put(`${path}/${id}`).set('Authorization', `Bearer ${token}`).send(update)
                            .expect(status[0])
                    })
    
                    test(`should ${ error ? '' : 'not ' }include error message`, async () => {
                        // Update dynamic values after each async call
                        id = invalidRequests()[i].id
                        token = invalidRequests()[i].token
                        const body = await updateBlog(id, token, update)
                        assert.equal(!!body.error, error)
                    })
                })
            })
        })
    })
})

afterEach(async () => {
    await Blog.deleteMany({})
    await User.deleteMany({})
})

after(async () => {
    await mongoose.connection.close()
    logger.info('Connection to MongoDB closed')
})