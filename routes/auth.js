const router = require("express").Router();
const passport = require("passport");
const User = require("../models/User");
const { ensureAuth } = require("../middleware/auth");

router.post("/signup", async (req, res, next) => {
  const { email, password, zip } = req.body;
  const user = await User.create({ email, password, zip });

  req.login(user, (loginError) => {
    if (loginError) return next(loginError);
    res.status(201).json(user);
  });
});

router.post("/login", (req, res, next) => {
  passport.authenticate("local", (error, user, info) => {
    if (error) return next(error);
    if (!user) return res.status(401).json({ error: info.message });

    req.login(user, (loginError) => {
      if (loginError) return next(loginError);
      res.json(user);
    });
  })(req, res, next);
});

router.post("/logout", (req, res, next) => {
  req.logout((error) => {
    if (error) return next(error);
    res.json({ message: "Logged out" });
  });
});

router.get("/me", ensureAuth, (req, res) => res.json(req.user));

module.exports = router;
