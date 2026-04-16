const mongoose = require("mongoose");

const courtSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    surface: {
      type: String,
      default: "Césped sintético",
    },
    isIndoor: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Court", courtSchema);
