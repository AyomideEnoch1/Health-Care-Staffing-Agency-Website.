'use strict';
const BaseAdapter = require('./BaseAdapter');
const crypto = require('crypto');

class ConsoleLogAdapter extends BaseAdapter {
  constructor() {
    super('console');
  }

  async send(options) {
    const messageId = `console-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const divider = '─'.repeat(70);

    console.log(`\n${divider}`);
    console.log(`📬 [DEV EMAIL DISPATCH] Provider: CONSOLE ADAPTER`);
    console.log(`   To:      ${options.to}`);
    console.log(`   Subject: ${options.subject}`);
    console.log(`   Msg ID:  ${messageId}`);
    if (options.text) {
      console.log(`   Preview: ${options.text.slice(0, 140).replace(/\n/g, ' ')}...`);
    }
    console.log(`${divider}\n`);

    return {
      success: true,
      messageId,
      provider: 'console',
      timestamp: new Date().toISOString()
    };
  }

  async sendBatch(batch) {
    console.log(`📬 [DEV BATCH EMAIL DISPATCH] Processing ${batch.length} messages via Console Adapter...`);
    return super.sendBatch(batch);
  }

  parseWebhook(payload) {
    return {
      eventType: payload.event || 'delivered',
      messageId: payload.messageId || 'console-synthetic',
      email: payload.email || 'developer@localhost',
      timestamp: new Date(),
      metadata: payload
    };
  }
}

module.exports = ConsoleLogAdapter;
