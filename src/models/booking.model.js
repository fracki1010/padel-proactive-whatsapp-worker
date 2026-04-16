const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null,
    },
    court: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Court",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    timeSlot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TimeSlot",
      required: true,
    },
    clientName: { type: String, required: true },
    clientPhone: { type: String, required: true },
    clientWhatsappId: { type: String, default: null },
    status: {
      type: String,
      enum: ["reservado", "confirmado", "cancelado", "suspendido"],
      default: "confirmado",
    },
    paymentStatus: {
      type: String,
      enum: ["pagado", "pendiente"],
      default: "pagado",
    },
    isFixed: {
      type: Boolean,
      default: false,
    },
    finalPrice: {
      type: Number,
      required: true,
    },
    attendanceConfirmationStatus: {
      type: String,
      enum: ["pending", "confirmed", "declined", "not_required"],
      default: null,
    },
    attendanceConfirmationSentAt: {
      type: Date,
      default: null,
    },
    attendanceConfirmationRespondedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

bookingSchema.index(
  { companyId: 1, court: 1, date: 1, timeSlot: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: "cancelado" } },
  },
);

module.exports = mongoose.model("Booking", bookingSchema);
