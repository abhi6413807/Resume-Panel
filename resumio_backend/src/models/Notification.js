const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Candidate",
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: [
        "Interview Scheduled",
        "Interview Updated",
        "Interview Cancelled",
        "Resume Shortlisted",
        "Resume Rejected",
        "Resume Selected",
        "Profile Updated",
      ],
      required: true,
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
