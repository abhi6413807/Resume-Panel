const cron = require("node-cron");
const Candidate = require("../models/Candidate");
const { sendEmail, sendSMS } = require("./notificationService");

async function checkAndSendReminders() {
  try {
    const now = new Date();
    // targetTime is 24 hours in the future
    const targetTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Query candidates who have a scheduled interview occurring within the next 24 hours
    // that hasn't received the reminder yet.
    // Condition:
    // - status is "Scheduled"
    // - reminderSent is not true
    // - dateTime is <= targetTime and > now
    const candidates = await Candidate.find({
      interviews: {
        $elemMatch: {
          status: "Scheduled",
          reminderSent: { $ne: true },
          dateTime: { $lte: targetTime, $gt: now },
        },
      },
    });

    for (const candidate of candidates) {
      let candidateModified = false;
      for (const interview of candidate.interviews) {
        if (
          interview.status === "Scheduled" &&
          !interview.reminderSent &&
          interview.dateTime <= targetTime &&
          interview.dateTime > now
        ) {
          // Check if the interview was scheduled at least 24 hours in advance.
          // Since createdAt is set when the interview is pushed, let's compare:
          const diffMs = interview.dateTime.getTime() - interview.createdAt.getTime();
          const advanceHours = diffMs / (1000 * 60 * 60);

          if (advanceHours < 23.9) {
            // It was scheduled less than 24 hours in advance.
            // Mark reminderSent = true so we don't check it again (since we are not sending it)
            interview.reminderSent = true;
            candidateModified = true;
            console.log(
              `[Scheduler] Skipping reminder for candidate ${candidate.fullName} (interview was scheduled less than 24h in advance: ${advanceHours.toFixed(1)}h ago)`
            );
            continue;
          }

          // Send Email and SMS
          try {
            console.log(
              `[Scheduler] Sending interview reminder to candidate: ${candidate.fullName} (${candidate.email})`
            );
            await sendEmail({
              to: candidate.email,
              candidateName: candidate.fullName,
              dateTime: interview.dateTime,
              mode: interview.mode,
              venueOrLink: interview.notes || "Online Link (To be shared)",
              interviewer: interview.interviewer,
            });

            const formattedTime = new Date(interview.dateTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            await sendSMS({
              to: candidate.phone,
              time: formattedTime,
            });

            interview.reminderSent = true;
            candidateModified = true;
          } catch (err) {
            console.error(
              `[Scheduler] Failed to send reminder to ${candidate.fullName}:`,
              err.message
            );
            // Do not set reminderSent = true to allow retry in subsequent runs if still within 24h window
          }
        }
      }

      if (candidateModified) {
        await candidate.save();
      }
    }
  } catch (error) {
    console.error("[Scheduler] Error in checkAndSendReminders:", error.message);
  }
}

function initScheduler() {
  console.log("[Scheduler] Initializing interview reminder cron job (every minute)...");
  cron.schedule("* * * * *", checkAndSendReminders);
}

module.exports = { initScheduler, checkAndSendReminders };
