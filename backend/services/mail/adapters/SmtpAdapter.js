'use strict';
const BaseAdapter = require('./BaseAdapter');
const nodemailer = require('nodemailer');
const { sanitizeHeader } = require('../../../utils/cryptoUtils');

class SmtpAdapter extends BaseAdapter {
  constructor(config = {}) {
    super('smtp');
    const defaultSmtpUser = 'ayomidenoch15@gmail.com';
    const defaultSmtpPass = 'uphdxparidfvocht';

    this.host = config.host || process.env.SMTP_HOST || 'smtp.gmail.com';
    this.port = parseInt(config.port || process.env.SMTP_PORT || '465', 10);
    this.secure = config.secure !== undefined ? config.secure : (process.env.SMTP_SECURE === 'true' || this.port === 465);
    this.user = (config.user || process.env.SMTP_USER || defaultSmtpUser).trim();
    let rawPass = config.pass || process.env.SMTP_PASS || defaultSmtpPass;
    if (this.host.includes('gmail')) {
      rawPass = rawPass.replace(/\s+/g, '');
    }
    this.pass = rawPass.trim();
    this.systemFrom = process.env.SYSTEM_FROM_EMAIL || `"Divine Fingers Healthcare" <${this.user}>`;

    this.transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.secure,
      pool: true,
      maxConnections: 5,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: false
      },
      auth: {
        user: this.user,
        pass: this.pass
      }
    });
  }

  async send(options) {
    const to = sanitizeHeader(options.to);
    const subject = sanitizeHeader(options.subject);
    const from = options.from ? sanitizeHeader(options.from) : this.systemFrom;

    const mailOptions = {
      from,
      to,
      subject,
      text: options.text || 'Please view this email in an HTML-compatible client.',
      html: options.html,
      replyTo: options.replyTo ? sanitizeHeader(options.replyTo) : undefined
    };

    const info = await this.transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: info.messageId,
      provider: 'smtp',
      raw: info
    };
  }

  parseWebhook(payload) {
    return {
      eventType: payload.event || 'delivered',
      messageId: payload.messageId || (payload['message-id'] || ''),
      email: payload.email || payload.recipient || '',
      timestamp: new Date(payload.timestamp || Date.now()),
      metadata: payload
    };
  }
}

module.exports = SmtpAdapter;
