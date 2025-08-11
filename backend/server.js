// Investment Analysis Backend (serverless-safe)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Stripe = require('stripe');
const PDFDocument = require('pdfkit');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
if (!/^sk_/.test(stripeSecret)) {
  console.warn('Stripe secret key missing or invalid. Set STRIPE_SECRET_KEY=sk_... in backend/.env');
}
const stripe = Stripe(stripeSecret);
const DOMAIN = process.env.DOMAIN || 'http://localhost:4200';
const PORT = process.env.PORT || 4000;

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { address } = req.body || {};
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      currency: 'aed',
      line_items: [{
        price_data: {
          currency: 'aed',
          product_data: { name: `Dubai Investment Report: ${address || 'Address TBC'}` },
          unit_amount: 9900
        },
        quantity: 1
      }],
      metadata: { address: address || '' },
      success_url: `${DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/`
    });
    res.json({ id: session.id });
  } catch (e) {
    console.error('Stripe create session error:', e);
    const msg = e?.raw?.message || e?.message || 'stripe_failed';
    res.status(500).json({ error: msg });
  }
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'missing session_id' });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (!session || session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'payment_required' });
    }
    const address = (session.metadata && session.metadata.address) || 'Dubai address';

    // Build analysis text (OpenAI optional)
    const openaiKey = process.env.OPENAI_API_KEY;
    let analysisText =
`Dubai Investment Analysis for: ${address}

Summary
- This is a template analysis. Add your OpenAI key to backend/.env to generate richer, dynamic content.

Key Metrics (illustrative only)
- Gross rental yield: (Annual Rent / Property Price) * 100
- Vacancy risk: Use neighbourhood occupancy/seasonality
- Capital growth drivers: infrastructure, population growth, supply pipeline
- Comparable rentals & sales: pull comps from your sources
- Recommendation: Conservative / Balanced / Aggressive`;

    if (openaiKey) {
      try {
        const openai = new OpenAI({ apiKey: openaiKey });
        const prompt = `Create a Dubai property investment analysis for the address: ${address}.
Include: Summary; Gross rental yield (explain formula & rough estimate if inputs unknown);
vacancy/seasonality; capital growth drivers; comparable sales & rents; risks; and a final recommendation.
Use concise bullet points.`;
        const chat = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }]
        });
        analysisText = chat.choices?.[0]?.message?.content || analysisText;
      } catch (aiErr) {
        console.warn('OpenAI generation failed, returning template:', aiErr.message);
      }
    }

    // Build PDF fully in memory (no filesystem writes)
    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.fontSize(18).text('Dubai Property Investment Analysis', { underline: true });
      doc.moveDown();
      doc.fontSize(12).text(`Address: ${address}`);
      doc.moveDown();
      doc.fontSize(11).text(analysisText);
      doc.end();
    });
    const base64 = pdfBuffer.toString('base64');

    res.json({ analysis: analysisText, fileBase64: `data:application/pdf;base64,${base64}` });
  } catch (e) {
    console.error('Analyze error:', e);
    res.status(500).json({ error: e.message || 'analyze_failed' });
  }
});

app.listen(PORT, () => console.log(`API listening on :${PORT}`));
