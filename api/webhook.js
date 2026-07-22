const Stripe = require('stripe');
const { Resend } = require('resend');
const { buffer } = require('micro');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const handler = async (req, res) => {
  // 1. Reject non-POST requests (like opening in browser)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let event;
  try {
    const buf = await buffer(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook Signature Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 2. Handle completed checkout
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const buyerEmail = session.customer_details?.email;

    try {
      // Create single-use Telegram link
      const tgResponse = await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/createChatInviteLink`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHAT_ID,
            member_limit: 1,
          }),
        }
      );

      const tgData = await tgResponse.json();

      if (tgData.ok) {
        const inviteLink = tgData.result.invite_link;

        // Send email via Resend
        await resend.emails.send({
          from: 'onboarding@resend.dev',
          to: buyerEmail,
          subject: 'Access Granted: Amir Amira Video Vault',
          html: `
            <div style="font-family: sans-serif; padding: 20px; color: #1c352d;">
              <h2>Welcome to Amir Amira Endurance Management!</h2>
              <p>Thank you for purchasing access to our Video Tutorial Vault.</p>
              <p>Click the link below to join our private Telegram group:</p>
              <br>
              <a href="${inviteLink}" style="padding: 14px 24px; background-color: #d4af37; color: #1c352d; font-weight: bold; text-decoration: none; border-radius: 6px; display: inline-block;">Join Telegram Video Vault</a>
              <br><br>
              <p style="font-size: 0.85rem; color: #777;">Note: This link is unique to your purchase and will self-destruct after 1 person joins.</p>
            </div>
          `,
        });
      } else {
        console.error('Telegram API Error:', tgData);
      }
    } catch (error) {
      console.error('Processing Error:', error);
    }
  }

  return res.status(200).json({ received: true });
};

module.exports = handler;

// Proper CommonJS config for Vercel
module.exports.config = {
  api: {
    bodyParser: false,
  },
};