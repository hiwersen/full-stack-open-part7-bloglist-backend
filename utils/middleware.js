require("dotenv").config();
const config = require("../utils/config");
const User = require("../models/user");
const Blog = require("../models/blog");
const jwt = require("jsonwebtoken");
const logger = require("./logger");

const requestLogger = (request, _, next) => {
  if (process.env.NODE_ENV !== "development") return next();

  logger.info("-------------------------");
  logger.info("Method ------------------:", request.method);
  logger.info("Path --------------------:", request.path);
  logger.info("Body --------------------:", request.body);
  logger.info("-------------------------");

  next();
};

const errorLogger = (error) => {
  if (process.env.NODE_ENV === "test") return;

  logger.error("-------------------------");
  logger.error("error code --------------:", error.code);
  logger.error("error name --------------:", error.name);
  logger.error("error message -----------:", error.message);
  logger.error("-------------------------");
};

const tokenExtractor = (request, _, next) => {
  const token = request.get("authorization");

  if (token && token.startsWith("Bearer ")) {
    request.token = token.replace("Bearer ", "");
  }

  next();
};

const userExtractor = async (request, _, next) => {
  const tokenUser = jwt.verify(request.token, config.JWT_SECRET);

  if (!tokenUser.id) {
    const error = new Error("unknown user");
    error.name = "AuthenticationError";
    return next(error);
  }

  const user = await User.findById(tokenUser.id);

  if (!user) {
    const error = new Error("invalid user");
    error.name = "AuthenticationError";
    return next(error);
  }

  request.user = user;

  next();
};

const blogExtractor = async (request, _, next) => {
  const blog = await Blog.findById(request.params.id)
    .populate("user", { username: 1, name: 1 })
    .populate("likes", { username: 1, name: 1 });

  if (!blog) {
    const error = new Error("blog not found");
    error.name = "BlogNotFound";
    return next(error);
  }

  request.blog = blog;

  next();
};

const unknownEndpoint = (_, response) => {
  return response.status(404).json({ error: "unknown endpoint" });
};

const errorHandler = (error, _, response, next) => {
  errorLogger(error);

  if (error.name === "ValidationError") {
    return response.status(400).json({ error: error.message });
  }

  if (error.name === "CastError") {
    return response.status(400).json({ error: error.message });
  }

  if (error.code === 11_000) {
    return response.status(400).json({ error: error.message });
  }

  if (error.name === "AuthenticationError") {
    return response.status(401).json({ error: error.message });
  }

  if (error.name === "JsonWebTokenError") {
    return response.status(401).json({ error: error.message });
  }

  if (error.name === "TokenExpiredError") {
    return response.status(401).json({ error: error.message });
  }

  if (error.name === "AuthorizationError") {
    return response.status(403).json({ error: error.message });
  }

  if (error.name === "BlogNotFound") {
    return response.status(404).json({ error: error.message });
  }

  next(error);
};

const middleware = {
  requestLogger,
  tokenExtractor,
  userExtractor,
  blogExtractor,
  errorHandler,
  unknownEndpoint,
};

module.exports = middleware;
