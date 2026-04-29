const mongoose = require("mongoose");

const digestBackgroundSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    data: {
      type: Buffer,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    order: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("DigestBackground", digestBackgroundSchema);
