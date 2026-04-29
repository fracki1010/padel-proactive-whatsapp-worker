const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  { name: { type: String, trim: true, default: "" } },
  { timestamps: true },
);

module.exports = mongoose.model("Company", companySchema);
