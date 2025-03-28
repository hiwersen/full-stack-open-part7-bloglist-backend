const mongoose = require('mongoose')
const config = require('../utils/config')
const Blog = require('../models/blog.js')

mongoose
    .connect(config.MONGODB_URI)
    .then(() => {
      console.log(`Connected to MongoDB`)
      migrate().then(() => { 
        console.log('Finished migration')
        mongoose.connection.close().then(() => console.log("Connection closed"))
      })
    })
    .catch(error => console.error(`Error connecting to MongoDB: ${error.message}`))



const migrate = async () => {
    const blogs = await Blog.find({ likes: { $not: { $type: 'array' } } })
    for (const blog of blogs) {
      blog.likes = []
      await blog.save()
  }
}

