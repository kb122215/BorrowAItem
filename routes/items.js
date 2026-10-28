const router = require("express").Router();
const Item = require("../models/Item");
const Borrow = require("../models/Borrow");
const { ensureAuth } = require("../middleware/auth");
const { CATEGORIES } = require("../config/constants");

router.use(ensureAuth); // every item page requires login

// ---------- Helpers ----------

// Turns Mongoose validation errors into one readable sentence
const validationMessage = (error) =>
  Object.values(error.errors)
    .map((e) => e.message)
    .join(". ");

// Only finds the item if it belongs to the logged-in user
const findMyItem = (id, userId) => Item.findOne({ _id: id, ownerId: userId });

// Today's date as "YYYY-MM-DD", the same format <input type="date"> sends
const getToday = () => new Date().toLocaleDateString("en-CA");

// NEW — checks borrow dates; returns an error message, or null if they're fine
const getDateError = (startDate, endDate) => {
  const isDate = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));

  if (!isDate(startDate) || !isDate(endDate))
    return "Pick a start date and an end date";
  if (startDate < getToday()) return "Start date can't be in the past";
  if (endDate < startDate) return "End date must be on or after the start date";
  return null;
};

// NEW — renders the item detail page with everything the view needs
const renderItemPage = async (
  req,
  res,
  item,
  { formError = null, values = {}, status = 200 } = {},
) => {
  const isOwner = item.ownerId.equals(req.user._id);

  // Has this user already asked to borrow it?
  const pendingRequest = isOwner
    ? null
    : await Borrow.findOne({
        itemId: item._id,
        borrowerId: req.user._id,
        status: "pending",
      });

  res.status(status).render("items/show", {
    title: item.name,
    item,
    isOwner,
    pendingRequest,
    formError,
    values,
    today: getToday(),
  });
};

// ---------- Browse ----------
router.get("/", async (req, res) => {
  const { category } = req.query;

  const zip =
    req.query.zip === undefined ? req.user.zip : String(req.query.zip).trim();
  const availableOnly = req.query.available === "on";
  const q = String(req.query.q || "")
    .trim()
    .slice(0, 50); // NEW — search text, max 50 chars

  // NEW — makes characters like . * ( ) match literally instead of as regex symbols
  const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const filter = { ownerId: { $ne: req.user._id } };
  if (CATEGORIES.includes(category)) filter.category = category;
  if (/^\d{5}$/.test(zip)) filter.zip = zip;
  if (availableOnly) filter.available = true;
  if (q) filter.name = { $regex: escapeRegex(q), $options: "i" }; // NEW — 'i' = ignore case

  const items = await Item.find(filter).sort({ available: -1, createdAt: -1 });

  res.render("items/index", {
    title: "Browse",
    items,
    filters: {
      q,
      category: filter.category || "",
      zip: filter.zip || "",
      availableOnly,
    },
  });
});

// ---------- My Items page ----------
router.get("/mine", async (req, res) => {
  const items = await Item.find({ ownerId: req.user._id }).sort({
    createdAt: -1,
  });
  res.render("items/mine", { title: "My Items", items });
});

// ---------- New item form ----------
router.get("/new", (req, res) => {
  res.render("items/new", {
    title: "List an item",
    formError: null,
    values: { zip: req.user.zip },
  });
});

// ---------- Create ----------
router.post("/", async (req, res, next) => {
  const { name, category, condition, zip } = req.body;

  try {
    await Item.create({
      ownerId: req.user._id,
      name,
      category,
      condition,
      zip,
    });
    req.flash("success", `"${name}" is now listed!`);
    res.redirect("/items/mine");
  } catch (error) {
    if (error.name !== "ValidationError") return next(error);
    res.status(400).render("items/new", {
      title: "List an item",
      formError: validationMessage(error),
      values: req.body,
    });
  }
});

// ---------- Edit form ----------
router.get("/:id/edit", async (req, res) => {
  const item = await findMyItem(req.params.id, req.user._id);
  if (!item) {
    req.flash("error", "Item not found");
    return res.redirect("/items/mine");
  }

  res.render("items/edit", {
    title: "Edit item",
    formError: null,
    values: item,
    itemId: item.id,
  });
});

// ---------- Update ----------
router.put("/:id", async (req, res, next) => {
  const item = await findMyItem(req.params.id, req.user._id);
  if (!item) {
    req.flash("error", "Item not found");
    return res.redirect("/items/mine");
  }

  const editable = ["name", "category", "condition", "zip"];
  editable.forEach((field) => {
    if (req.body[field] !== undefined) item[field] = req.body[field];
  });

  try {
    await item.save();
    req.flash("success", "Item updated");
    res.redirect("/items/mine");
  } catch (error) {
    if (error.name !== "ValidationError") return next(error);
    res.status(400).render("items/edit", {
      title: "Edit item",
      formError: validationMessage(error),
      values: req.body,
      itemId: item.id,
    });
  }
});

// ---------- Delete ----------
router.delete("/:id", async (req, res) => {
  const item = await findMyItem(req.params.id, req.user._id);
  if (!item) {
    req.flash("error", "Item not found");
    return res.redirect("/items/mine");
  }

  if (!item.available) {
    req.flash(
      "error",
      "You can't remove an item while someone is borrowing it",
    );
    return res.redirect("/items/mine");
  }

  await Borrow.deleteMany({ itemId: item._id, status: "pending" });
  await item.deleteOne();
  req.flash("success", `"${item.name}" was removed`);
  res.redirect("/items/mine");
});

// ---------- Item detail page ----------
router.get("/:id", async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) {
    return res.status(404).render("error", {
      title: "Not found",
      status: 404,
      message: "We couldn't find that item.",
    });
  }

  await renderItemPage(req, res, item);
});

// ---------- Send a borrow request ----------
router.post("/:id/borrow", async (req, res) => {
  const item = await Item.findById(req.params.id);
  if (!item) {
    req.flash("error", "Item not found");
    return res.redirect("/items");
  }

  const itemPage = `/items/${item.id}`;

  if (item.ownerId.equals(req.user._id)) {
    req.flash("error", "You can't borrow your own item");
    return res.redirect(itemPage);
  }

  if (!item.available) {
    req.flash("error", "This item is currently borrowed");
    return res.redirect(itemPage);
  }

  const alreadyRequested = await Borrow.exists({
    itemId: item._id,
    borrowerId: req.user._id,
    status: "pending",
  });
  if (alreadyRequested) {
    req.flash("error", "You already have a pending request for this item");
    return res.redirect(itemPage);
  }

  const { startDate, endDate } = req.body;
  const dateError = getDateError(startDate, endDate);
  if (dateError) {
    return renderItemPage(req, res, item, {
      formError: dateError,
      values: { startDate, endDate },
      status: 400,
    });
  }

  await Borrow.create({
    itemId: item._id,
    borrowerId: req.user._id,
    ownerId: item.ownerId,
    startDate,
    endDate,
  });

  req.flash("success", "Request sent! The owner will approve or decline it.");
  res.redirect(itemPage);
});

module.exports = router;
