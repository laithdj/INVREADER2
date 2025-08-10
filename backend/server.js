// Investment Analysis Backend - Express + Stripe + OpenAI + PDF
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Stripe = require('stripe');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
if (!stripeSecret) {
  console.warn('WARN: STRIPE_SECRET_KEY missing. /create-checkout-session will fail until you configure .env');
}
const stripe = Stripe(stripeSecret);
const DOMAIN = process.env.DOMAIN || 'http://localhost:4200';
const PORT = process.env.PORT || 4000;

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Create Stripe Checkout Session
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    const { address } = req.body || {};
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      currency: 'aed',
      line_items: [
        {
          price_data: {
            currency: 'aed',
            product_data: { name: `Dubai Investment Report: ${address || 'Address TBC'}` },
            // amount is in fils (AED * 100)
            unit_amount: 9000
          },
          quantity: 1
        }
      ],
      // store the address so we can read it after payment
      metadata: { address: address || '' },
      success_url: `${DOMAIN}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${DOMAIN}/`
    });
    res.json({ id: session.id });
  } catch (e) {
    console.error('Stripe create session error:', e);
    res.status(500).json({ error: e.message || 'stripe_failed' });
  }
});

// Generate analysis after payment, return text + PDF url
app.post('/api/analyze', async (req, res) => {
  try {
    const { session_id } = req.body || {};
    if (!session_id) return res.status(400).json({ error: 'missing session_id' });

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (!session || session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'payment_required' });
    }
    const address = (session.metadata && session.metadata.address) || 'Dubai address';

    // Build analysis text (OpenAI is optional)
    const openaiKey = process.env.OPENAI_API_KEY;
    let analysisText =
`Dubai Investment Analysis for: ${address}

Summary
- This is a template analysis. Add your OpenAI key to backend/.env to generate richer, dynamic content.

Key Metrics (illustrative only)
- Gross rental yield: (Annual Rent / Property Price) * 100
- Vacancy risk: Use neighbourhood occupancy and seasonality
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

    // Create a simple PDF report
    const reportsDir = path.join(__dirname, 'reports');
    if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir);
    const filename = `report_${Date.now()}.pdf`;
    const filePath = path.join(reportsDir, filename);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(fs.createWriteStream(filePath));
    doc.fontSize(18).text('Dubai Property Investment Analysis', { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Address: ${address}`);
    doc.moveDown();
    doc.fontSize(11).text(analysisText);
    doc.end();

    // Serve reports statically
    app.use('/reports', express.static(reportsDir));

    res.json({
      analysis: analysisText,
      fileUrl: `/reports/${filename}`
    });
  } catch (e) {
    console.error('Analyze error:', e);
    res.status(500).json({ error: e.message || 'analyze_failed' });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on :${PORT}`);
});
