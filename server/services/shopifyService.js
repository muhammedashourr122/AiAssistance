// server/services/shopifyService.js
const { shopifyApi } = require('@shopify/shopify-api');
const { ApiVersion } = require('@shopify/shopify-api');

// Initialize Shopify API
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SHOPIFY_SCOPES.split(','),
  hostName: process.env.SHOPIFY_APP_URL.replace(/https?:\/\//, ''),
  apiVersion: ApiVersion.October23,
  isEmbeddedApp: true,
});

class ShopifyService {
  constructor() {
    this.shopify = shopify;
  }

  // Create REST client for API calls
  createClient(shopDomain, accessToken) {
    return new this.shopify.clients.Rest({
      session: {
        shop: shopDomain,
        accessToken: accessToken
      }
    });
  }

  // Get single product
  async getProduct(shopDomain, accessToken, productId) {
    try {
      const client = this.createClient(shopDomain, accessToken);
      
      const response = await client.get({
        path: `products/${productId}`,
      });
      
      return response.body.product;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw new Error('Failed to fetch product from Shopify');
    }
  }

  // Get multiple products with pagination
  async getProducts(shopDomain, accessToken, options = {}) {
    try {
      const client = this.createClient(shopDomain, accessToken);
      
      const {
        limit = 50,
        sinceId = null,
        productType = null,
        vendor = null,
        status = 'active'
      } = options;

      const query = {
        limit,
        status,
        ...(sinceId && { since_id: sinceId }),
        ...(productType && { product_type: productType }),
        ...(vendor && { vendor })
      };
      
      const response = await client.get({
        path: 'products',
        query
      });
      
      return {
        products: response.body.products,
        hasNextPage: response.body.products.length === limit,
        lastProductId: response.body.products[response.body.products.length - 1]?.id
      };
    } catch (error) {
      console.error('Error fetching products:', error);
      throw new Error('Failed to fetch products from Shopify');
    }
  }

  // Update product description
  async updateProduct(shopDomain, accessToken, productId, updates) {
    try {
      const client = this.createClient(shopDomain, accessToken);
      
      const response = await client.put({
        path: `products/${productId}`,
        data: {
          product: {
            id: productId,
            ...updates
          }
        }
      });
      
      return response.body.product;
    } catch (error) {
      console.error('Error updating product:', error);
      throw new Error('Failed to update product in Shopify');
    }
  }

  // Get shop information
  async getShopInfo(shopDomain, accessToken) {
    try {
      const client = this.createClient(shopDomain, accessToken);
      
      const response = await client.get({
        path: 'shop',
      });
      
      return response.body.shop;
    } catch (error) {
      console.error('Error fetching shop info:', error);
      throw new Error('Failed to fetch shop information');
    }
  }

  // Verify webhook
  verifyWebhook(data, hmacHeader) {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET);
    hmac.update(data, 'utf8');
    const hash = hmac.digest('base64');
    
    return hash === hmacHeader;
  }

  // Generate OAuth URL
  generateAuthUrl(shopDomain, state) {
    const authRoute = this.shopify.auth.begin({
      shop: shopDomain,
      callbackPath: '/api/auth/callback',
      isOnline: false, // Offline access for background operations
    });
    
    return authRoute;
  }

  // Validate OAuth callback
  async validateCallback(query) {
    try {
      const session = await this.shopify.auth.callback({
        rawRequest: { url: `?${new URLSearchParams(query).toString()}` },
      });
      
      return session;
    } catch (error) {
      console.error('OAuth validation error:', error);
      throw new Error('Invalid OAuth callback');
    }
  }

  // Product data formatter for AI service
  formatProductForAI(product) {
    return {
      id: product.id,
      title: product.title,
      body_html: product.body_html,
      product_type: product.product_type,
      vendor: product.vendor,
      tags: product.tags,
      variants: product.variants?.map(variant => ({
        id: variant.id,
        title: variant.title,
        price: variant.price,
        sku: variant.sku,
        weight: variant.weight,
        weight_unit: variant.weight_unit
      })),
      images: product.images?.map(image => ({
        src: image.src,
        alt: image.alt
      })),
      options: product.options?.map(option => ({
        name: option.name,
        values: option.values
      }))
    };
  }

  // Test Shopify connection
  async testConnection(shopDomain, accessToken) {
    try {
      const shopInfo = await this.getShopInfo(shopDomain, accessToken);
      return {
        success: true,
        shopName: shopInfo.name,
        email: shopInfo.email,
        domain: shopInfo.domain
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new ShopifyService();