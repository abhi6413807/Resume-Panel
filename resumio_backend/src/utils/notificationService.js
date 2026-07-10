const nodemailer = require("nodemailer");
const twilio = require("twilio");

// Email transporter configuration
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.EMAIL_PORT || "587"),
    secure: process.env.EMAIL_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

async function sendEmail({ to, candidateName, dateTime, mode, venueOrLink, interviewer }) {
  const transporter = createTransporter();
  const dateStr = new Date(dateTime).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = new Date(dateTime).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const companyName = process.env.COMPANY_NAME || "Resumio";
  const contactPerson = interviewer;

  const mailOptions = {
    from: process.env.EMAIL_FROM || `"Recruitment Team" <no-reply@resumio.com>`,
    to,
    subject: `Interview Reminder - ${companyName}`,
    text: `Hello ${candidateName},

This is a reminder that you have an interview scheduled for tomorrow.

Details of the interview:
Candidate Name: ${candidateName}
Date: ${dateStr}
Time: ${timeStr}
Interview Mode: ${mode}
Meeting Link / Venue: ${venueOrLink}
Company Name: ${companyName}
Contact Person: ${contactPerson}

Please make sure you are available on time.

Best of luck,
Recruitment Team`,
    html: `
      <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px;">
        <h2 style="color: #1f7a5a; border-bottom: 2px solid #1f7a5a; padding-bottom: 8px; margin-top: 0;">Interview Reminder</h2>
        <p>Hello <strong>${candidateName}</strong>,</p>
        <p>This is a reminder that you have an interview scheduled for tomorrow.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; font-weight: bold; color: #4a5568; width: 180px;">Candidate Name</td>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; color: #2d3748;">${candidateName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; font-weight: bold; color: #4a5568;">Date</td>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; color: #2d3748;">${dateStr}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; font-weight: bold; color: #4a5568;">Time</td>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; color: #2d3748;">${timeStr}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; font-weight: bold; color: #4a5568;">Interview Mode</td>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; color: #2d3748;">${mode}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; font-weight: bold; color: #4a5568;">Meeting Link / Venue</td>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; color: #2d3748;">${venueOrLink}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; font-weight: bold; color: #4a5568;">Company Name</td>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; color: #2d3748;">${companyName}</td>
          </tr>
          <tr>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; font-weight: bold; color: #4a5568;">Contact Person</td>
            <td style="padding: 10px; border-bottom: 1px solid #edf2f7; color: #2d3748;">${contactPerson}</td>
          </tr>
        </table>
        
        <p style="margin-top: 24px; font-weight: bold; color: #2d3748;">Please make sure you are available on time.</p>
        <p style="margin-bottom: 0;">Best of luck,<br/><span style="color: #5a6858;">Recruitment Team</span></p>
      </div>
    `,
  };

  // If credentials are not set, log the email in console
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log("=================== EMAIL MOCK SENT ===================");
    console.log(`To: ${mailOptions.to}`);
    console.log(`Subject: ${mailOptions.subject}`);
    console.log(`Text: ${mailOptions.text}`);
    console.log("=======================================================");
    return;
  }

  await transporter.sendMail(mailOptions);
}

async function sendSMS({ to, time }) {
  const messageBody = `Reminder: Your interview is scheduled tomorrow at ${time}. Please check your email for complete details. Best of luck!`;

  // Check if Twilio config is available
  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_FROM_NUMBER
  ) {
    console.log("==================== SMS MOCK SENT ====================");
    console.log(`To: ${to}`);
    console.log(`Message: ${messageBody}`);
    console.log("=======================================================");
    return;
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    body: messageBody,
    from: process.env.TWILIO_FROM_NUMBER,
    to,
  });
}

module.exports = { sendEmail, sendSMS };
