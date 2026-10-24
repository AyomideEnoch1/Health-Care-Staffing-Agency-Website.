'use strict';
const BaseAdapter = require('./BaseAdapter');
const { sanitizeHeader } = require('../../../utils/cryptoUtils');

class ResendAdapter extends BaseAdapter {
  constructor(apiKey = null) {
    super('resend');
    this.apiKey = (apiKey || process.env.RESEND_API_KEY || process.env.RESEND_KEY || '').trim();
    this.systemFrom = process.env.RESEND_FROM_EMAIL || process.env.SYSTEM_FROM_EMAIL || 'Divine Fingers Healthcare <onboarding@resend.dev>';
  }

  async send(options) {
    const to = sanitizeHeader(options.to);
    const subject = sanitizeHeader(options.subject);
    let from = options.from ? sanitizeHeader(options.from) : this.systemFrom;

    if (!from || from.includes('@gmail.com') || from.includes('@yahoo.com') || from.includes('@hotmail.com')) {
      from = 'Divine Fingers Healthcare <onboarding@resend.dev>';
    }

    if (!this.apiKey) {
      throw new Error('ResendAdapter: RESEND_API_KEY is not configured.');
    }

    const payload = {
      from,
      to: [to],
      subject,
      html: options.html,
      text: options.text || 'Please view this email in an HTML-compatible client.'
    };

    if (options.replyTo) {
      payload.reply_to = sanitizeHeader(options.replyTo);
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(`Resend API HTTP ${res.status}: ${data.message || JSON.stringify(data)}`);
    }

    return {
      success: true,
      messageId: data.id || `resend-${Date.now()}`,
      provider: 'resend',
      raw: data
    };
  }

  parseWebhook(payload) {
    return {
      eventType: payload.type || 'delivered',
      messageId: (payload.data && payload.data.email_id) || '',
      email: (payload.data && payload.data.to && payload.data.to[0]) || '',
      timestamp: new Date(payload.created_at || Date.now()),
      metadata: payload
    };
  }
}

module.exports = ResendAdapter;
