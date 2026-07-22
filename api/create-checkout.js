const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'fpx'], // Enables FPX Bank Transfer & Credit/Debit Cards
      line_items: [
        {
          price_data: {
            currency: 'myr', // FPX requires MYR
            product_data: {
              name: 'Equestrian Video Vault Pass',
              description: 'Instant single-use invitation to private Telegram group.',
            },
            unit_amount: 15000, // RM 150.00 (Amount in sen)
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${req.headers.origin}/index.html?payment=success`,
      cancel_url: `${req.headers.origin}/index.html?payment=cancelled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};