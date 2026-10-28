const ensureAuth = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  req.flash("error", "Please log in first");
  res.redirect("/login");
};

// Logged-in users don't need to see login/signup
const ensureGuest = (req, res, next) => {
  if (!req.isAuthenticated()) return next();
  res.redirect("/items");
};

module.exports = { ensureAuth, ensureGuest };
