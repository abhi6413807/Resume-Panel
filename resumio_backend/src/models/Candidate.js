const mongoose = require("mongoose");

const educationSchema = new mongoose.Schema(
  {
    degree: String,
    institute: String,
    year: String,
    grade: String,
  },
  { _id: false }
);

const experienceSchema = new mongoose.Schema(
  {
    company: String,
    role: String,
    from: String,
    to: String,
    description: String,
  },
  { _id: false }
);

const interviewSchema = new mongoose.Schema(
  {
    dateTime: { type: Date, required: true },
    mode: {
      type: String,
      enum: ["Online", "Offline", "Phone"],
      default: "Online",
    },
    interviewer: { type: String, required: true },
    status: {
      type: String,
      enum: ["Scheduled", "Completed", "Cancelled"],
      default: "Scheduled",
    },
    notes: String,
    reminderSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const candidateSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    roleApplied: { type: String, required: true, trim: true },
    totalExperience: { type: Number, default: 0 },
    currentCompany: { type: String, trim: true },
    expectedCTC: { type: String, trim: true },
    currentLocation: { type: String, trim: true },
    summary: { type: String, trim: true },
    skills: [{ type: String, trim: true }],
    education: [educationSchema],
    experience: [experienceSchema],
    resumeUrl: { type: String, trim: true },
    interviews: [interviewSchema],
    password: { type: String },
    role: { type: String, enum: ["DATA_ENTRY_OPERATOR", "CANDIDATE", "USER"], default: "CANDIDATE" },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    github: { type: String, default: "" },
    portfolio: { type: String, default: "" },
    profilePhoto: { type: String, default: "" },
    status: { type: String, enum: ["Applied", "Shortlisted", "Rejected", "Selected", "Sent to Manager"], default: "Applied" },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    createdByOperator: { type: Boolean, default: false },
    sentToManager: { type: Boolean, default: false },
    deletedByOperator: { type: Boolean, default: false },
  },
  { timestamps: true }
);

candidateSchema.pre("save", function (next) {
  if (this.interviews && this.interviews.length > 0) {
    this.interviews.forEach((interview) => {
      if (interview.isModified("dateTime")) {
        interview.reminderSent = false;
      }
    });
  }
  next();
});

module.exports = mongoose.model("Candidate", candidateSchema);
