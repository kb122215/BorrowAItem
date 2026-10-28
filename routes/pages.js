const router = require("express").Router();

router.get("/", (req, res) => {
  if (req.isAuthenticated()) return res.redirect("/items");
  res.render("index", { title: "Home" });
});

module.exports = router;
