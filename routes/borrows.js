const router = require("express").Router();
const Borrow = require("../models/Borrow");
const Item = require("../models/Item");
const { ensureAuth } = require("../middleware/auth");

router.use(ensureAuth);

// ---------- Helpers ----------

const groupByStatus = (borrows) => ({
  pending: borrows.filter((b) => b.status === "pending"),
  approved: borrows.filter((b) => b.status === "approved"),
  history: borrows.filter(
    (b) => b.status === "declined" || b.status === "returned",
  ),
});

const findRequest = (id, ownerId) => Borrow.findOne({ _id: id, ownerId });

const backToRequests = (req, res, type, message) => {
  req.flash(type, message);
  res.redirect("/borrows/requests");
};

// NEW — counts thumbs up/down each borrower has received from past lenders.
// Returns { "<borrowerId>": { up: 3, down: 0 }, ... }
const getBorrowerRatings = async (borrowerIds) => {
  const results = await Borrow.aggregate([
    {
      $match: {
        borrowerId: { $in: borrowerIds },
        ownerRating: { $in: ["up", "down"] },
      },
    },
    {
      $group: {
        _id: "$borrowerId",
        up: { $sum: { $cond: [{ $eq: ["$ownerRating", "up"] }, 1, 0] } },
        down: { $sum: { $cond: [{ $eq: ["$ownerRating", "down"] }, 1, 0] } },
      },
    },
  ]);

  return Object.fromEntries(
    results.map((r) => [r._id.toString(), { up: r.up, down: r.down }]),
  );
};

// ---------- My Borrows ----------
router.get("/mine", async (req, res) => {
  const borrows = await Borrow.find({ borrowerId: req.user._id })
    .populate("itemId", "name category")
    .populate("ownerId", "email")
    .sort({ createdAt: -1 });

  res.render("borrows/mine", {
    title: "My Borrows",
    groups: groupByStatus(borrows),
  });
});

// ---------- Requests ----------
router.get("/requests", async (req, res) => {
  const borrows = await Borrow.find({ ownerId: req.user._id })
    .populate("itemId", "name category")
    .populate("borrowerId", "email")
    .sort({ createdAt: -1 });

  const borrowerIds = borrows
    .filter((b) => b.borrowerId)
    .map((b) => b.borrowerId._id); // NEW
  const ratings = await getBorrowerRatings(borrowerIds); // NEW

  res.render("borrows/requests", {
    title: "Requests",
    groups: groupByStatus(borrows),
    ratings,
  });
});

// ---------- Approve ----------
router.put("/:id/approve", async (req, res) => {
  const borrow = await findRequest(req.params.id, req.user._id);
  if (!borrow) return backToRequests(req, res, "error", "Request not found");
  if (borrow.status !== "pending") {
    return backToRequests(
      req,
      res,
      "error",
      `This request was already ${borrow.status}`,
    );
  }

  const item = await Item.findOneAndUpdate(
    { _id: borrow.itemId, available: true },
    { available: false },
  );
  if (!item)
    return backToRequests(req, res, "error", "This item is already lent out");

  borrow.status = "approved";
  await borrow.save();

  await Borrow.updateMany(
    { itemId: borrow.itemId, status: "pending", _id: { $ne: borrow._id } },
    { status: "declined" },
  );

  backToRequests(
    req,
    res,
    "success",
    `Approved! "${item.name}" is now marked as borrowed.`,
  );
});

// ---------- Decline ----------
router.put("/:id/decline", async (req, res) => {
  const borrow = await findRequest(req.params.id, req.user._id);
  if (!borrow) return backToRequests(req, res, "error", "Request not found");
  if (borrow.status !== "pending") {
    return backToRequests(
      req,
      res,
      "error",
      `This request was already ${borrow.status}`,
    );
  }

  borrow.status = "declined";
  await borrow.save();
  backToRequests(req, res, "success", "Request declined");
});

// ---------- Mark returned ----------
router.put("/:id/return", async (req, res) => {
  const borrow = await findRequest(req.params.id, req.user._id);
  if (!borrow) return backToRequests(req, res, "error", "Request not found");
  if (borrow.status !== "approved") {
    return backToRequests(
      req,
      res,
      "error",
      "Only items that are lent out can be marked returned",
    );
  }

  borrow.status = "returned";
  await borrow.save();
  await Item.findByIdAndUpdate(borrow.itemId, { available: true });

  backToRequests(
    req,
    res,
    "success",
    "Marked as returned. How did it go? Rate the borrower below.",
  );
});

// ---------- Rate the borrower ----------                              // NEW
router.put("/:id/rate", async (req, res) => {
  const { rating } = req.body;
  if (!["up", "down"].includes(rating)) {
    return backToRequests(req, res, "error", "Pick thumbs up or thumbs down");
  }

  const borrow = await findRequest(req.params.id, req.user._id);
  if (!borrow) return backToRequests(req, res, "error", "Request not found");
  if (borrow.status !== "returned") {
    return backToRequests(
      req,
      res,
      "error",
      "You can rate a borrower once the item is returned",
    );
  }
  if (borrow.ownerRating) {
    return backToRequests(req, res, "error", "You already rated this borrow");
  }

  borrow.ownerRating = rating;
  await borrow.save();
  backToRequests(
    req,
    res,
    "success",
    "Thanks! Your rating helps neighbors lend with confidence.",
  );
});

module.exports = router;
