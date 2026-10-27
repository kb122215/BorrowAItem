const errorHandler = (error, req, res, next) => {
  console.error(error.message);

  if (error.name === "CastError")
    return res.status(400).json({ error: "Malformed id" });
  if (error.name === "ValidationError")
    return res.status(400).json({ error: error.message });
  if (error.code === 11000)
    return res.status(400).json({ error: "Email already in use" });

  res.status(500).json({ error: "Something went wrong" });
};

module.exports = errorHandler;
