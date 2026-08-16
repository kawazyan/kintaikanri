import { Resend } from "resend";

let resendClient: Resend | null = null;

function getClient() {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set");
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function sendMail(params: {
  to: string | string[];
  subject: string;
  text: string;
}) {
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error("MAIL_FROM is not set");
  try {
    await getClient().emails.send({
      from,
      to: params.to,
      subject: params.subject,
      text: params.text,
    });
  } catch (err) {
    console.error("Failed to send mail", { to: params.to, subject: params.subject, err });
  }
}
