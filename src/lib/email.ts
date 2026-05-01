import { Resend } from "resend";

const DEFAULT_RESEND_FROM_EMAIL = "onboarding@resend.dev";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? DEFAULT_RESEND_FROM_EMAIL;
const TEST_FROM_EMAIL =
  process.env.RESEND_TEST_FROM_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? DEFAULT_RESEND_FROM_EMAIL;
const TEST_TO_EMAIL = "kswalker2201@gmail.com";

function getResendClient(): Resend {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  return new Resend(resendApiKey);
}

export async function sendInviteEmail(
  to: string,
  username: string,
  appUrl: string
): Promise<void> {
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "You've been invited to IT Support KB",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
        <h2 style="color: #0f766e;">You've been invited to IT Support KB</h2>
        <p>An administrator has created an account for you.</p>
        <p><strong>Your username:</strong> ${username}</p>
        <p>
          To get started, visit <a href="${appUrl}" style="color: #0f766e;">${appUrl}</a>
          and sign in with your username. You will be prompted to set your password on first login.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8;">IT Support KB - Internal knowledge base</p>
      </div>
    `
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  try {
    const resend = getResendClient();
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Your sign-in code",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
          <h2 style="color: #0f766e;">Your sign-in code</h2>
          <p>Use the code below to complete your sign-in to IT Support KB.</p>
          <div style="
            display: inline-block;
            font-size: 36px;
            font-weight: 700;
            letter-spacing: 0.3em;
            color: #0f766e;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 8px;
            padding: 16px 32px;
            margin: 16px 0;
          ">${code}</div>
          <p style="color: #64748b; font-size: 14px;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8;">IT Support KB - Internal knowledge base</p>
        </div>
      `
    });
  } catch (err) {
    console.error("[sendOtpEmail]", err);
  }
}

export async function sendWelcomeEmail(to: string, username: string): Promise<void> {
  try {
    const resend = getResendClient();
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: "Welcome to IT Support KB",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
          <h2 style="color: #0f766e;">Welcome to IT Support KB, ${username}!</h2>
          <p>Your account is all set up and ready to go.</p>
          <p>Sign in any time to browse and contribute to the internal knowledge base.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8;">IT Support KB - Internal knowledge base</p>
        </div>
      `
    });
  } catch (err) {
    console.error("[sendWelcomeEmail]", err);
  }
}

export async function sendResendTestEmail(): Promise<void> {
  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: TEST_FROM_EMAIL,
    to: TEST_TO_EMAIL,
    subject: "IT Support KB test email",
    html: "<p>Congrats on sending your <strong>first IT Support KB test email</strong>!</p>"
  });

  if (error) {
    throw new Error(error.message);
  }
}
