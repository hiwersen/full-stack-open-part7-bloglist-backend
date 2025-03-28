require("express-async-errors");
const express = require("express");
const app = express();
const cors = require("cors");
const mongoose = require("mongoose");
const config = require("./utils/config");
const logger = require("./utils/logger");
const loginRouter = require("./controllers/login");
const usersRouter = require("./controllers/users");
const blogsRouter = require("./controllers/blogs");
const middleware = require("./utils/middleware");
const path = require("path");

mongoose.set("strictQuery", false);

mongoose
  .connect(config.MONGODB_URI)
  .then(() => logger.info(`Connected to MongoDB`))
  .catch((error) =>
    logger.error(`Error connecting to MongoDB: ${error.message}`)
  );

app.use(cors());
app.use(express.json());
app.use(middleware.requestLogger);
app.use(middleware.tokenExtractor);
app.use(express.static("dist"));

app.use("/api/login", loginRouter);
app.use("/api/users", usersRouter);
app.use("/api/blogs", blogsRouter);

// SPA fallback route
app.get("*", (_, res) => {
  res.sendFile(path.resolve(__dirname, "dist", "index.html"));
});

app.use(middleware.unknownEndpoint);
app.use(middleware.errorHandler);

module.exports = app;
