import { serve } from '@hono/node-server';
import 'dotenv/config';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import Stripe from 'stripe';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY is not defined in environment variables.');
}
if (!stripeWebhookSecret) {
  throw new Error(
    'STRIPE_WEBHOOK_SECRET is not defined in environment variables.'
  );
}

const stripe = new Stripe(stripeSecretKey);

const app = new Hono();

const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stripe Checkout</title>
    <style>
    body {
      font-family: sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background-color: #f0f0f0;
    }

    .container {
      text-align: center;
      padding: 20px;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    button {
      padding: 10px 20px;
      font-size: 16px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
     button:hover {
        background-color: #0056b3;
     }
    </style>
</head>
<body>
    <div class="container">
    <h1>Simple Checkout</h1>
     <form method="POST" action="/checkout">
     <button type="submit">Checkout</button>
    </form>
  </div>
</body>
</html>
`;

app.get('/', (c) => {
  c.header('Content-Type', 'text/html');
  return c.html(html);
});

app.get('/success', (c) => {
  return c.text('Success!');
});

app.get('/cancel', (c) => {
  return c.text('Hello Hono!');
});

app.post('/checkout', async (c) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: 'price_1QcQJeAx2rGD3R0SgKIiswU6',
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'http://localhost:3000/success',
      cancel_url: 'http://localhost:3000/cancel',
    });
    return c.redirect(session.url);
  } catch (error: any) {
    console.error(error);
    const message = error?.message || 'An unknown error occurred.';
    throw new HTTPException(500, { message });
  }
});

app.post('/webhook', async (c) => {
  const rawBody = await c.req.text();
  const signature = c.req.header('stripe-signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature!,
      stripeWebhookSecret!
    );
  } catch (error: any) {
    console.error(`Webhook signature verification failed: ${error.message}`);
    throw new HTTPException(400);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Checkout Session Completed:', session);
    // TODO: Implement your fulfillment logic here
  }
  return c.text('success');
});

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

export default app;
