import { Resend } from 'resend';

const ResendKey = 're_dCfz3PAA_3gup78ShXBSr7JwZzEp18vTF';
const resend = new Resend(ResendKey);

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
 