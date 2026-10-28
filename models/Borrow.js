const mongoose = require("mongoose");

const borrowSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },
    borrowerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "declined", "returned"],
      default: "pending",
    },
    ownerRating: { type: String, enum: ["up", "down"] }, // NEW — set by the owner after a return
  },
  { timestamps: true },
);

// NEW — true when an item is still out after its end date.
// Calculated on the fly, never saved, so it's always accurate.
borrowSchema.virtual("isOverdue").get(function () {
  if (this.status !== "approved") return false;
  const today = new Date().toLocaleDateString("en-CA"); // "YYYY-MM-DD"
  const end = this.endDate.toISOString().slice(0, 10); // "YYYY-MM-DD"
  return end < today;
});

borrowSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Borrow", borrowSchema);
