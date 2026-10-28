const errorHandler = (error, req, res, next) => {
  console.error(error);

  // A bad id in the URL (e.g. /items/abc/edit) is really a "not found"
  const status = error.name === "CastError" ? 404 : 500;
  const message =
    status === 404
      ? "We couldn't find that page."
      : "Something went wrong on our end. Please try again.";

  res.status(status).render("error", { title: "Error", status, message });
};

module.exports = errorHandler;
