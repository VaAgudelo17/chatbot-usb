class ContextManager {
  constructor() {
    this.contexts = new Map();
  }

  getContext(userId) {
    return this.contexts.get(userId);
  }

  updateContext(userId, newContext) {
    const currentContext = this.contexts.get(userId) || {};
    this.contexts.set(userId, { ...currentContext, ...newContext });
  }

  clearContext(userId) {
    this.contexts.delete(userId);
  }
}

module.exports = ContextManager;