class ContextManager {
  constructor() {
    this.contexts = {};
  }

  getContext(userId) {
    return this.contexts[userId] || null;
  }

  updateContext(userId, newContext) {
    if (!this.contexts[userId]) {
      this.contexts[userId] = {};
    }
    this.contexts[userId] = { ...this.contexts[userId], ...newContext };
  }

  clearContext(userId) {
    delete this.contexts[userId];
  }
}

module.exports = ContextManager;