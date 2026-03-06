import nodemailer from "nodemailer";

export async function sendOTPEmail(toEmail: string, toName: string, otp: string): Promise<boolean> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn("[Email] SMTP_USER or SMTP_PASS not configured. OTP:", otp);
    return true; // Fallback for development: log to console
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"VisaFlow System" <${user}>`,
      to: toEmail,
      subject: "Your VisaFlow Email Verification OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #3b82f6; font-size: 24px; margin: 0;">🌐 VisaFlow</h1>
            <p style="color: #94a3b8; font-size: 12px; letter-spacing: 3px; margin-top: 4px;">FUTURISTIC EDITION</p>
          </div>
          <h2 style="color: #f1f5f9; font-size: 18px; margin-bottom: 8px;">Email Verification</h2>
          <p style="color: #94a3b8; margin-bottom: 24px;">Hello ${toName}, use the OTP below to verify your account.</p>
          <div style="background: #1e293b; border: 2px solid #3b82f6; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px;">Your One-Time Password</p>
            <p style="color: #3b82f6; font-size: 40px; font-weight: bold; letter-spacing: 12px; margin: 0; font-family: monospace;">${otp}</p>
          </div>
          <p style="color: #64748b; font-size: 13px; text-align: center;">This OTP expires in <strong style="color: #f59e0b;">5 minutes</strong>. Do not share it with anyone.</p>
          <hr style="border-color: #1e293b; margin: 24px 0;" />
          <p style="color: #475569; font-size: 11px; text-align: center;">VisaFlow Visa Processing System · Secured by AI & Blockchain</p>
        </div>
      `,
    });

    console.log(`[Email] OTP sent successfully to ${toEmail}`);
    return true;
  } catch (err) {
    console.error("[Email] Send failed:", err);
    return false;
  }
}
