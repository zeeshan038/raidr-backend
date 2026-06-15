import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async ({ to, subject, text, html }) => {
  try {
    const data = await resend.emails.send({
      from: 'no-reply@softmintlabs.tech',
      to: [to],
      subject: subject,
      text: text,
      html: html
    });

    console.log('Email sent via Resend:', data);
    return data;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

export default sendEmail;
 