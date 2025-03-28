const dummy = blogs => 1

const totalLikes = blogs => 
    blogs.reduce((sum, { likes }) => 
        Number(likes) 
            ? sum + Number(likes)
            : sum
        , 0)

const favoriteBlog = blogs =>
    blogs.reduce((favorite, { title, author, likes }) => 
        favorite.likes >= likes
            ? favorite
            :  { title, author, likes }
        , {})

const mostBlogs = blogs => {
    const map = {}
    let mostBlogs = {}

    blogs.forEach(({ author }) => {
        map[author] = (map[author] || 0) + 1
        const blogs = map[author]
        if ( blogs > (mostBlogs.blogs || 0)) 
            mostBlogs = { author, blogs }
    })

    return mostBlogs
}

const mostLikes = blogs => {
    const map = {}
    let mostLikes = {}

    blogs.forEach(({ author, likes }) => {
        map[author] = (map[author] || 0) + Number(likes || 0)
        likes = map[author]
        if ( likes > (mostLikes.likes || 0)) 
            mostLikes = { author, likes }
    })

    return mostLikes
}

module.exports = { dummy, totalLikes, favoriteBlog, mostBlogs, mostLikes }
