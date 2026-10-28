const router = require("express").Router();
const passport = require("passport");
const User = require("../models/User");
const { ensureGuest } = require("../middleware/auth");

// ---------- Sign up ----------
router.get("/signup", ensureGuest, (req, res) => {
  res.render("auth/signup", { title: "Sign up", formError: null, values: {} });
});

router.post("/signup", ensureGuest, async (req, res, next) => {
  const { email, password, confirmPassword, zip } = req.body;
  const values = { email, zip }; // refill the form if there's an error (never the password)

  if (password !== confirmPassword) {
    return res.status(400).render("auth/signup", {
      title: "Sign up",
      formError: "Passwords do not match",
      values,
    });
  }

  try {
    const user = await User.create({ email, password, zip });
    req.login(user, (loginError) => {
      if (loginError) return next(loginError);
      req.flash("success", "Welcome to BorrowAItem!");
      res.redirect("/items");
    });
  } catch (error) {
    if (error.code === 11000 || error.name === "ValidationError") {
      const formError =
        error.code === 11000
          ? "An account with that email already exists"
          : Object.values(error.errors)
              .map((e) => e.message)
              .join(". ");

      return res
        .status(400)
        .render("auth/signup", { title: "Sign up", formError, values });
    }
    next(error);
  }
});

// ---------- Log in ----------
router.get("/login", ensureGuest, (req, res) => {
  res.render("auth/login", { title: "Log in", formError: null, values: {} });
});

router.post("/login", ensureGuest, (req, res, next) => {
  passport.authenticate("local", (error, user, info) => {
    if (error) return next(error);

    if (!user) {
      return res.status(401).render("auth/login", {
        title: "Log in",
        formError: info.message,
        values: { email: req.body.email },
      });
    }

    req.login(user, (loginError) => {
      if (loginError) return next(loginError);
      req.flash("success", "Welcome back!");
      res.redirect("/items");
    });
  })(req, res, next);
});

// ---------- Log out ----------
router.post("/logout", (req, res, next) => {
  req.logout((error) => {
    if (error) return next(error);
    req.flash("success", "You've been logged out");
    res.redirect("/");
  });
});

module.exports = router;
