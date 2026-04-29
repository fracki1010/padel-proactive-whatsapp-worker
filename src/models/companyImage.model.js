const mongoose = require("mongoose");

const companyImageSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
      index: true,
    },
    type: { type: String },
    cloudinaryPublicId: { type: String },
    url: { type: String },
    order: { type: Number, default: 1 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("CompanyImage", companyImageSchema);
