'use strict';
const BaseAdapter = require('./BaseAdapter');
const { sanitizeHeader } = require('../../../utils/cryptoUtils');

function parseFromAddress(fromStr) {
  const match = (fromStr || '').match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
  if (match) {
    return {
      name: (match[1] || 'Divine Fingers Healthcare').trim(),
      email: match[2].trim()
    };
  }
  return {
    name: 'Divine Fingers Healthcare',
    email: (fromStr || 'noreply@divinefingershealthcare.ca').trim()
  };
}

class BrevoAdapter extends BaseAdapter {
  constructor(apiKey = null) {
    super('brevo');
    this.apiKey = (apiKey || process.env.BREVO_API_KEY || process.env.BREVO_KEY || process.env.SENDINBLUE_API_KEY || '').trim();
    this.systemFrom = process.env.SYSTEM_FROM_EMAIL || 'Divine Fingers Healthcare <info@divinefingershealthcare.ca>';
  }

  async send(options) {
    const to = sanitizeHeader(options.to);
    const subject = sanitizeHeader(options.subject);
    const fromStr = options.from ? sanitizeHeader(options.from) : this.systemFrom;
    const parsedFrom = parseFromAddress(fromStr);

    if (!this.apiKey) {
      throw new Error('BrevoAdapter: BREVO_API_KEY is not configured.');
    }

    const payload = {
      sender: { name: parsedFrom.name, email: parsedFrom.email },
      to: [{ email: to }],
      subject,
      htmlContent: options.html,
      textContent: options.text || 'Please view this email in an HTML-compatible client.'
    };

    if (options.replyTo) {
      payload.replyTo = { email: sanitizeHeader(options.replyTo) };
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(`Brevo API HTTP ${res.status}: ${data.message || JSON.stringify(data)}`);
    }

    return {
      success: true,
      messageId: data.messageId || `brevo-${Date.now()}`,
      provider: 'brevo',
      raw: data
    };
  }

  parseWebhook(payload) {
    return {
      eventType: payload.event || 'delivered',
      messageId: payload['message-id'] || '',
      email: payload.email || '',
      timestamp: new Date(payload.date || Date.now()),
      metadata: payload
    };
  }
}

module.exports = BrevoAdapter;
