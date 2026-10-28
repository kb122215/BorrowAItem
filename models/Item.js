const mongoose = require("mongoose");
const { CATEGORIES, CONDITIONS } = require("../config/constants");

const itemSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
      maxlength: [60, "Item name must be 60 characters or less"],
    },
    category: {
      type: String,
      required: [true, "Pick a category"],
      enum: { values: CATEGORIES, message: "Pick a valid category" },
    },
    condition: {
      type: String,
      required: [true, "Pick a condition"],
      enum: { values: CONDITIONS, message: "Pick a valid condition" },
    },
    zip: {
      type: String,
      required: [true, "Zip code is required"],
      match: [/^\d{5}$/, "Zip code must be 5 digits"],
    },
    available: { type: Boolean, default: true },
  },
  { timestamps: true },
);

itemSchema.set("toJSON", {
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = mongoose.model("Item", itemSchema);
