const EventEmitter = require('events');

class AdminEventBus extends EventEmitter {}
const adminEvents = new AdminEventBus();

module.exports = adminEvents;
