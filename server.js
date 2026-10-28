require("dotenv").config();
const path = require("node:path");
const express = require("express");
const session = require("express-session");
const { MongoStore } = require("connect-mongo");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const passport = require("passport");
const morgan = require("morgan");
const connectDB = require("./config/database");
const errorHandler = require("./middleware/errorHandler");
const {
  CATEGORIES,
  CONDITIONS,
  CATEGORY_ICONS,
} = require("./config/constants");
const formatDate = require("./utils/formatDate");
const Borrow = require("./models/Borrow");

require("./config/passport")(passport);

const pageRoutes = require("./routes/pages");
const authRoutes = require("./routes/auth");
const itemRoutes = require("./routes/items");
const borrowRoutes = require("./routes/borrows");

const app = express();
connectDB();

// EJS setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Lists and helpers every view can use
app.locals.CATEGORIES = CATEGORIES;
app.locals.CONDITIONS = CONDITIONS;
app.locals.CATEGORY_ICONS = CATEGORY_ICONS;
app.locals.formatDate = formatDate;

// Static files
app.use(express.static(path.join(__dirname, "public")));

// Body parsing
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(morgan("dev"));

// Sessions
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  }),
);
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Variables available in every EJS view
app.use(async (req, res, next) => {
  // CHANGED — now async
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.pendingCount = req.user
    ? await Borrow.countDocuments({ ownerId: req.user._id, status: "pending" })
    : 0;
  next();
});

// Routes
app.use("/", pageRoutes);
app.use("/", authRoutes);
app.use("/items", itemRoutes);
app.use("/borrows", borrowRoutes);

// 404 for any URL that didn't match a route
app.use((req, res) => {
  res.status(404).render("error", {
    title: "Not found",
    status: 404,
    message: "We couldn't find that page.",
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
