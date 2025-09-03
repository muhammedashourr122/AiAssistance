const fetch = require('node-fetch');

class ShopifySimpleService {
  
  async getProducts(shopDomain, accessToken, limit = 10) {
    try {
      const url = `https://${shopDomain}/admin/api/2023-10/products.json?limit=${limit}`;
      
      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Shopify API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data.products;
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  async getProduct(shopDomain, accessToken, productId) {
    try {
      const url = `https://${shopDomain}/admin/api/2023-10/products/${productId}.json`;
      
      const response = await fetch(url, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status}`);
      }

      const data = await response.json();
      return data.product;
    } catch (error) {
      console.error('Error fetching product:', error);
      throw error;
    }
  }

  async updateProduct(shopDomain, accessToken, productId, description) {
    try {
      const url = `https://${shopDomain}/admin/api/2023-10/products/${productId}.json`;
      
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product: {
            id: productId,
            body_html: description
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Shopify API error: ${response.status}`);
      }

      const data = await response.json();
      return data.product;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }
}

module.exports = new ShopifySimpleService();