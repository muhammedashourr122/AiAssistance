require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fetch = require('node-fetch'); // npm install node-fetch
const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'] // مهم عشان يظهر لك أي أخطاء
});
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../frontend"))); // فولدر frontend

// =======================
// Shopify OAuth
// =======================
app.get('/auth', (req, res) => {
  const shop = req.query.shop;
  if (!shop) return res.status(400).send('Shop parameter missing');

  const state = Math.random().toString(36).substring(2, 15);
  const redirectUri = `${process.env.HOST}/auth/callback`;

  const installUrl = `https://${shop}/admin/oauth/authorize?client_id=${process.env.SHOPIFY_API_KEY}&scope=${process.env.SCOPES}&state=${state}&redirect_uri=${redirectUri}`;

  res.redirect(installUrl);
});

app.get('/auth/callback', async (req, res) => {
  const { shop, code } = req.query;
  if (!shop || !code) return res.status(400).send('Required params missing');

  const accessTokenRequestUrl = `https://${shop}/admin/oauth/access_token`;
  const accessTokenPayload = {
    client_id: process.env.SHOPIFY_API_KEY,
    client_secret: process.env.SHOPIFY_API_SECRET,
    code,
  };

  try {
    const response = await fetch(accessTokenRequestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(accessTokenPayload),
    });

    const data = await response.json();
    const accessToken = data.access_token;

    // تخزين أو تحديث المتجر في قاعدة البيانات
    await prisma.shop.upsert({
      where: { shopDomain: shop },
      update: { accessToken },
      create: { shopDomain: shop, accessToken },
    });

    res.redirect('/'); // توجه المستخدم للواجهة الرئيسية
  } catch (err) {
    console.error(err);
    res.status(500).send('Error while exchanging access token');
  }
});

// Webhook لإلغاء التثبيت
app.post('/webhooks/app/uninstalled', async (req, res) => {
  const shop = req.headers['x-shopify-shop-domain'];
  await prisma.shop.delete({ where: { shopDomain: shop } });
  res.sendStatus(200);
});

// =======================
// AI Endpoints
// =======================
app.post('/api/test-ai', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ error: 'OpenAI API key not configured' });
    }
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say "AI working!" and nothing else.' }],
      max_tokens: 10
    });
    res.json({
      success: true,
      response: completion.choices[0].message.content
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// مثال لتوليد وصف منتجات (تقدر تضيف بقية الـ endpoints القديمة هنا)
app.post('/api/generate-description', async (req, res) => {
  try {
    const { productTitle, tone } = req.body;
    if (!productTitle) return res.status(400).json({ error: 'Product title is required' });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `Create a ${tone || 'professional'} product description for: ${productTitle}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7
    });

    res.json({ success: true, generatedDescription: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// =======================
// Serve SPA
// =======================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on ${process.env.HOST || 'http://localhost:' + PORT}`);
});
