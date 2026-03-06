// Resend integration — OTP email service
import { Resend } from "resend";

let connectionSettings: any;

async function getResendCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? "depl " + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error("X-Replit-Token not found for repl/depl");
  }

  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=resend",
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    }
  )
    .then((res) => res.json())
    .then((data) => data.items?.[0]);

  if (!connectionSettings || !connectionSettings.settings.api_key) {
    throw new Error("Resend not connected");
  }

  return {
    apiKey: connectionSettings.settings.api_key as string,
    fromEmail: (connectionSettings.settings.from_email as string) || "onboarding@resend.dev",
  };
}

// WARNING: Never cache this client. Tokens expire.
async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getResendCredentials();
  return { client: new Resend(apiKey), fromEmail };
}

export async function sendOTPEmail(toEmail: string, toName: string, otp: string): Promise<boolean> {
  try {
    const { client, fromEmail } = await getUncachableResendClient();

    const { error } = await client.emails.send({
      from: `VisaFlow System <${fromEmail}>`,
      to: toEmail,
      subject: "Your VisaFlow Email Verification OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0f172a; color: #e2e8f0; padding: 32px; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #3b82f6; font-size: 24px; margin: 0;">&#127760; VisaFlow</h1>
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
          <p style="color: #475569; font-size: 11px; text-align: center;">VisaFlow Visa Processing System &middot; Secured by AI &amp; Blockchain</p>
        </div>
      `,
    });

    if (error) {
      console.error("[Email] Resend error:", error);
      return false;
    }

    console.log("[Email] OTP sent successfully to", toEmail);
    return true;
  } catch (err) {
    console.error("[Email] Send failed:", err);
    return false;
  }
}
