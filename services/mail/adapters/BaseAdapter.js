'use strict';

/**
 * Base Provider Adapter Contract
 * All email transmission providers (SMTP, Brevo, Console Dev) implement this interface.
 */
class BaseAdapter {
  constructor(name = 'base') {
    this.name = name;
  }

  /**
   * Send a single message
   * @param {{ to: string, from?: string, subject: string, html: string, text: string, replyTo?: string, headers?: object }} options
   * @returns {Promise<{ success: boolean, messageId: string, provider: string, raw?: any }>}
   */
  async send(options) {
    throw new Error(`send() not implemented in ${this.constructor.name}`);
  }

  /**
   * Send a batch of messages
   * @param {Array<{ to: string, subject: string, html: string, text: string }>} batch
   * @returns {Promise<Array<{ success: boolean, messageId?: string, error?: string }>>}
   */
  async sendBatch(batch) {
    const results = [];
    for (const item of batch) {
      try {
        const res = await this.send(item);
        results.push(res);
      } catch (err) {
        results.push({ success: false, error: err.message });
      }
    }
    return results;
  }

  /**
   * Parse inbound webhook event payload into normalized format
   * @param {object} payload
   * @returns {{ eventType: 'delivered'|'bounced'|'opened'|'clicked'|'complained', messageId: string, email: string, timestamp: Date, metadata?: object }}
   */
  parseWebhook(payload) {
    throw new Error(`parseWebhook() not implemented in ${this.constructor.name}`);
  }
}

module.exports = BaseAdapter;
