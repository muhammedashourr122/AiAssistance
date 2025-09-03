// server/services/aiService.js
const OpenAI = require('openai');

class AIService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.promptTemplates = {
      professional: `Create a professional, trustworthy product description that builds confidence and highlights value.`,
      casual: `Write a friendly, conversational description that feels like a recommendation from a friend.`,
      luxury: `Craft an elegant, premium description that emphasizes quality, exclusivity, and sophistication.`,
      technical: `Write a detailed, informative description focusing on specifications and technical benefits.`
    };
  }

  async generateProductDescription(productData, options = {}) {
    const {
      tone = 'professional',
      targetLength = 'medium',
      includeKeywords = [],
      additionalContext = '',
      includeFeatures = true,
      includeBenefits = true
    } = options;

    try {
      const prompt = this.buildPrompt(productData, {
        tone,
        targetLength,
        includeKeywords,
        additionalContext,
        includeFeatures,
        includeBenefits
      });

      console.log('Generating content for:', productData.title);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: this.getMaxTokens(targetLength),
        temperature: 0.7,
        presence_penalty: 0.1,
        frequency_penalty: 0.1
      });

      const generatedContent = completion.choices[0].message.content.trim();
      const tokensUsed = completion.usage.total_tokens;

      return {
        content: generatedContent,
        tokensUsed,
        model: 'gpt-4'
      };

    } catch (error) {
      console.error('OpenAI API Error:', error);
      
      if (error.code === 'rate_limit_exceeded') {
        throw new Error('AI service is temporarily busy. Please try again in a moment.');
      } else if (error.code === 'insufficient_quota') {
        throw new Error('AI service quota exceeded. Please contact support.');
      } else {
        throw new Error('Failed to generate content. Please try again.');
      }
    }
  }

  getSystemPrompt() {
    return `You are an expert e-commerce copywriter with 10+ years of experience creating high-converting product descriptions for online stores.

Your expertise includes:
- Writing compelling copy that converts browsers into buyers
- SEO optimization for better search visibility
- Understanding customer psychology and pain points
- Adapting tone and style for different audiences
- Creating scannable, well-structured content

Always write in HTML format using appropriate tags like <p>, <ul>, <li>, <strong>, <em>.
Focus on benefits over features, and always include a clear call-to-action.`;
  }

  buildPrompt(productData, options) {
    const { tone, targetLength, includeKeywords, additionalContext, includeFeatures, includeBenefits } = options;
    
    const lengthGuide = {
      short: '80-120 words',
      medium: '150-200 words',
      long: '250-350 words'
    };

    // Extract product information
    const productInfo = this.extractProductInfo(productData);
    
    return `
Write a ${tone} product description for an e-commerce store.

PRODUCT INFORMATION:
Title: ${productInfo.title}
Price: ${productInfo.price}
Product Type: ${productInfo.type}
Vendor/Brand: ${productInfo.vendor}
Current Description: ${productInfo.currentDescription}
Key Features: ${productInfo.features}
Tags: ${productInfo.tags}

REQUIREMENTS:
- Length: ${lengthGuide[targetLength]}
- Tone: ${this.promptTemplates[tone]}
- ${includeFeatures ? 'Include key features naturally' : 'Focus on benefits over features'}
- ${includeBenefits ? 'Emphasize customer benefits and value' : ''}
- ${includeKeywords.length > 0 ? `Naturally include these keywords: ${includeKeywords.join(', ')}` : ''}
- Use HTML formatting (<p>, <ul>, <li>, <strong> tags)
- Include a compelling call-to-action
- Make it SEO-friendly
- Structure for easy scanning (short paragraphs, bullet points where appropriate)

${additionalContext ? `ADDITIONAL CONTEXT: ${additionalContext}` : ''}

Write ONLY the product description in HTML format. Do not include any introductory text or explanations.
    `.trim();
  }

  extractProductInfo(productData) {
    return {
      title: productData.title || 'Unknown Product',
      price: productData.variants?.[0]?.price ? `$${productData.variants[0].price}` : 'Contact for pricing',
      type: productData.product_type || 'General',
      vendor: productData.vendor || 'Unknown Brand',
      currentDescription: this.stripHtml(productData.body_html) || 'No current description',
      features: this.extractFeatures(productData),
      tags: productData.tags || 'None'
    };
  }

  extractFeatures(productData) {
    const features = [];
    
    // Extract from title
    if (productData.title) {
      features.push(productData.title);
    }
    
    // Extract from variants
    if (productData.variants && productData.variants.length > 0) {
      productData.variants.forEach(variant => {
        if (variant.title && variant.title !== 'Default Title') {
          features.push(variant.title);
        }
      });
    }
    
    // Extract from tags
    if (productData.tags) {
      features.push(...productData.tags.split(',').map(tag => tag.trim()));
    }
    
    return features.slice(0, 5).join(', '); // Limit to top 5 features
  }

  stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  }

  getMaxTokens(targetLength) {
    const tokenLimits = {
      short: 200,
      medium: 350,
      long: 500
    };
    return tokenLimits[targetLength] || 350;
  }

  // Method to test AI connection
  async testConnection() {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: 'Say "AI service connected successfully"'
          }
        ],
        max_tokens: 20
      });
      
      return completion.choices[0].message.content;
    } catch (error) {
      throw new Error(`AI service connection failed: ${error.message}`);
    }
  }
}

module.exports = new AIService();