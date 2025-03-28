const blogsRouter = require('express').Router()
const Blog = require('../models/blog')
const middleware = require('../utils/middleware')

blogsRouter.get('/', async (_, response) => {
    const blogs = await Blog.find({})
        .populate('user', { username: 1, name: 1 })
        .populate('likes', { username: 1, name: 1 })
    response.json(blogs)
})

blogsRouter.get('/:id', middleware.blogExtractor, async (request, response) => {
    const { blog } = request
    response.json(blog)
})

blogsRouter.post('/', middleware.userExtractor, async (request, response) => {
    const { user } = request
    const { title, author, url } = request.body
    const blog = new Blog({ title, author, url, user: user._id })
    const result = await blog.save()
    await result.populate('user', { username: 1, name: 1 })
    user.blogs = user.blogs.concat(result._id)
    await user.save()

    response.status(201).json(result)
})

blogsRouter.post('/:id/like',
    middleware.userExtractor,
    middleware.blogExtractor,
    async (request, response) => {
    const { user, blog } = request

    blog.likes = blog.likes.concat(user._id)

    const result = await blog.save()
    await result.populate('user', { username: 1, name: 1 })
    await result.populate('likes', { username: 1, name: 1 })

    response.json(result)
})

blogsRouter.post('/:id/comments', middleware.blogExtractor, async (request, response) => {
    const { blog } = request
    const { comment } = request.body

    if (!comment) return response.status(400).end()
    blog.comments = blog.comments.concat(comment)

    const result = await blog.save()
    await result.populate('user', { username: 1, name: 1 })

    response.json(result)
})

blogsRouter.put('/:id', async (request, response, next) => {
    const id = request.params.id
    const { title, author, url } = request.body
    const update = { title, author, url }

    const result = await Blog.findOneAndUpdate(
        { _id: id }, 
        update, 
        { new: true, runValidators: true, context: 'query' })
        .populate('user', { username: 1, name: 1 })
    
    if (!result) {
        const blog = await Blog.findById(id)
        if (!blog) return response.status(404).end()

        const error = new Error('unauthorized user')
        error.name = 'AuthorizationError'
        return next(error)
    }

    response.json(result)
})

blogsRouter.delete('/:id', 
    middleware.userExtractor,
    middleware.blogExtractor,
    async (request, response, next) => {
    const { user, blog } = request

    if (user._id.toString() !== blog.user?._id.toString()) {
        const error = new Error('unauthorized user')
        error.name = 'AuthorizationError'
        return next(error)
    }

    user.blogs = user.blogs.filter(b => b.toString() !== blog._id.toString())
    await user.save()

    await blog.deleteOne()

    response.status(204).end()
})

module.exports = blogsRouter