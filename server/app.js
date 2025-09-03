require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;


import path from "path";
import express from "express";
const app = express();

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../frontend"))); // عدّل حسب اسم فولدر الـ frontend

// Catch-all route to serve index.html for React/SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.')); // Serve static files

// Basic routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'AI Shopify App - Basic Server Running!',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    server: 'running'
  });
});

// Test AI connection
app.post('/api/test-ai', async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_key_here') {
      return res.status(400).json({ 
        error: 'OpenAI API key not configured. Please add it to your .env file.' 
      });
    }

    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Say "AI working!" and nothing else.' }],
      max_tokens: 10
    });

    res.json({
      success: true,
      response: completion.choices[0].message.content,
      tokensUsed: completion.usage.total_tokens
    });

  } catch (error) {
    console.error('AI Test Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate product description (mock for now)
app.post('/api/generate-description', async (req, res) => {
  try {
    const { productTitle, productPrice, productType, tone } = req.body;
    
    if (!productTitle) {
      return res.status(400).json({ error: 'Product title is required' });
    }

    // Check OpenAI key
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_key_here') {
      return res.status(400).json({ 
        error: 'OpenAI API key not configured' 
      });
    }

    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `Create a ${tone || 'professional'} product description for:
    
Product: ${productTitle}
Price: ${productPrice || 'Contact for pricing'}
Type: ${productType || 'General product'}

Requirements:
- 150-200 words
- Professional tone
- Include benefits and features
- Add call-to-action
- Use HTML format with <p> tags

Write only the description:`;

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
    console.error('Description generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    const shopCount = await prisma.shop.count();
    await prisma.$disconnect();
    
    res.json({
      success: true,
      message: 'Database connected successfully!',
      shopCount: shopCount,
      dbType: 'PostgreSQL (Neon)'
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Generate and save product description
app.post('/api/generate-and-save', async (req, res) => {
  try {
    const { productTitle, productPrice, productType, tone } = req.body;
    
    if (!productTitle) {
      return res.status(400).json({ error: 'Product title is required' });
    }

    // Generate with AI
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `Create a ${tone || 'professional'} e-commerce product description:

Product: ${productTitle}
Price: ${productPrice || 'Contact for pricing'}
Category: ${productType || 'General product'}

Requirements:
- 150-200 words
- Highlight key benefits and features
- Include compelling call-to-action
- Use HTML format with <p> tags
- Make it SEO-friendly

Write only the description:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.7
    });

    const generatedContent = completion.choices[0].message.content;

    // Save to database
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    // Create or find test shop
    let shop = await prisma.shop.findFirst();
    if (!shop) {
      shop = await prisma.shop.create({
        data: {
          shopDomain: 'test-shop.myshopify.com',
          accessToken: 'test-token',
          subscriptionStatus: 'trial',
          usageCount: 0,
          usageLimit: 100
        }
      });
    }

    // Update usage count
    await prisma.shop.update({
      where: { id: shop.id },
      data: { usageCount: shop.usageCount + 1 }
    });

    // Save generated content
    const savedContent = await prisma.generatedContent.create({
      data: {
        shopId: shop.id,
        productId: `test-${Date.now()}`,
        productTitle: productTitle,
        generatedDescription: generatedContent,
        contentType: 'description',
        tone: tone || 'professional',
        tokensUsed: completion.usage.total_tokens
      }
    });

    await prisma.$disconnect();

    res.json({
      success: true,
      contentId: savedContent.id,
      productTitle: productTitle,
      generatedDescription: generatedContent,
      tokensUsed: completion.usage.total_tokens,
      tone: tone || 'professional',
      savedAt: savedContent.createdAt,
      usageRemaining: shop.usageLimit - shop.usageCount
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test Shopify connection with better debugging
app.post('/api/test-shopify', async (req, res) => {
  try {
    const { shopDomain, accessToken } = req.body;
    
    console.log('Testing Shopify connection...');
    console.log('Shop Domain:', shopDomain);
    console.log('Access Token length:', accessToken ? accessToken.length : 'missing');
    
    if (!shopDomain || !accessToken) {
      return res.status(400).json({ 
        error: 'Shop domain and access token required' 
      });
    }

    // Validate shop domain format
    if (!shopDomain.includes('.myshopify.com')) {
      return res.status(400).json({ 
        error: 'Shop domain should be in format: your-store.myshopify.com' 
      });
    }

    const shopifyService = require('./services/shopifySimple');
    const products = await shopifyService.getProducts(shopDomain, accessToken, 5);
    
    console.log('Products fetched successfully:', products.length);
    
    res.json({
      success: true,
      message: 'Shopify connected successfully!',
      shopDomain: shopDomain,
      productCount: products.length,
      sampleProducts: products.map(p => ({ 
        id: p.id, 
        title: p.title, 
        price: p.variants[0]?.price,
        hasDescription: !!p.body_html
      }))
    });

  } catch (error) {
    console.error('Shopify test error details:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  }
});

// Generate description for real Shopify product
app.post('/api/generate-shopify-product', async (req, res) => {
  try {
    const { shopDomain, accessToken, productId, tone } = req.body;
    
    if (!shopDomain || !accessToken || !productId) {
      return res.status(400).json({ 
        error: 'Shop domain, access token, and product ID required' 
      });
    }

    // Get product from Shopify
    const shopifyService = require('./services/shopifySimple');
    const product = await shopifyService.getProduct(shopDomain, accessToken, productId);
    
    // Generate AI description
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `Create a compelling ${tone || 'professional'} product description for this Shopify product:

Product Title: ${product.title}
Price: $${product.variants[0]?.price}
Product Type: ${product.product_type}
Vendor: ${product.vendor}
Current Description: ${product.body_html ? 'Has existing description' : 'No description'}
Tags: ${product.tags}

Requirements:
- 150-250 words
- Highlight benefits and features
- Include strong call-to-action
- Use HTML format with <p>, <strong>, and <ul> tags
- Make it conversion-focused
- SEO-friendly

Write only the product description:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.7
    });

    const generatedDescription = completion.choices[0].message.content;

    // Save to database
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    let shop = await prisma.shop.findUnique({ where: { shopDomain } });
    if (!shop) {
      shop = await prisma.shop.create({
        data: {
          shopDomain,
          accessToken: 'stored_securely',
          subscriptionStatus: 'trial'
        }
      });
    }

    const savedContent = await prisma.generatedContent.create({
      data: {
        shopId: shop.id,
        productId: productId,
        productTitle: product.title,
        originalDescription: product.body_html,
        generatedDescription: generatedDescription,
        contentType: 'description',
        tone: tone || 'professional',
        tokensUsed: completion.usage.total_tokens
      }
    });

    await prisma.$disconnect();

    res.json({
      success: true,
      contentId: savedContent.id,
      product: {
        id: product.id,
        title: product.title,
        price: product.variants[0]?.price,
        originalDescription: product.body_html
      },
      generatedDescription: generatedDescription,
      tokensUsed: completion.usage.total_tokens,
      canApplyToShopify: true
    });

  } catch (error) {
    console.error('Shopify product generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Apply generated description to Shopify product
app.post('/api/apply-to-shopify', async (req, res) => {
  try {
    const { shopDomain, accessToken, productId, description } = req.body;
    
    const shopifyService = require('./services/shopifySimple');
    const updatedProduct = await shopifyService.updateProduct(
      shopDomain, 
      accessToken, 
      productId, 
      description
    );
    
    res.json({
      success: true,
      message: 'Description applied to Shopify product!',
      productId: updatedProduct.id,
      productTitle: updatedProduct.title
    });

  } catch (error) {
    console.error('Apply to Shopify error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🧪 AI Test: http://localhost:${PORT}/test.html`);
});