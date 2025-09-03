// Load environment variables
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai');
const shopifyService = require('./services/shopifySimple');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, "../frontend"))); 

// Catch-all for SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Basic API
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', server: 'running' });
});

// Test AI connection
app.post('/api/test-ai', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_key_here') {
      return res.status(400).json({ error: 'OpenAI API key not configured.' });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say "AI working!"' }],
      max_tokens: 10
    });

    res.json({ success: true, response: completion.choices[0].message.content });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test DB connection
app.get('/api/test-db', async (req, res) => {
  try {
    const prisma = new PrismaClient();
    const shopCount = await prisma.shop.count();
    await prisma.$disconnect();

    res.json({ success: true, message: 'Database connected!', shopCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Generate product description
app.post('/api/generate-description', async (req, res) => {
  try {
    const { productTitle, productPrice, productType, tone } = req.body;
    if (!productTitle) return res.status(400).json({ error: 'Product title is required' });

    if (!process.env.OPENAI_API_KEY) {
      return res.status(400).json({ error: 'OpenAI API key not configured' });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `Create a ${tone || 'professional'} product description for:
Product: ${productTitle}
Price: ${productPrice || 'Contact for pricing'}
Type: ${productType || 'General product'}
Requirements: 150-200 words, professional, include benefits and call-to-action, HTML <p> tags`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7
    });

    res.json({
      success: true,
      originalTitle: productTitle,
      generatedDescription: completion.choices[0].message.content,
      tokensUsed: completion.usage.total_tokens,
      tone: tone || 'professional'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Shopify connection test
app.post('/api/test-shopify', async (req, res) => {
  try {
    const { shopDomain, accessToken } = req.body;
    if (!shopDomain || !accessToken) return res.status(400).json({ error: 'Shop domain and access token required' });

    if (!shopDomain.includes('.myshopify.com')) {
      return res.status(400).json({ error: 'Invalid shop domain format' });
    }

    const products = await shopifyService.getProducts(shopDomain, accessToken, 5);
    res.json({ success: true, shopDomain, productCount: products.length, sampleProducts: products });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Apply generated description to Shopify
app.post('/api/apply-to-shopify', async (req, res) => {
  try {
    const { shopDomain, accessToken, productId, description } = req.body;
    if (!shopDomain || !accessToken || !productId || !description) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const updatedProduct = await shopifyService.updateProduct(shopDomain, accessToken, productId, description);
    res.json({ success: true, message: 'Description applied!', productId: updatedProduct.id });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
