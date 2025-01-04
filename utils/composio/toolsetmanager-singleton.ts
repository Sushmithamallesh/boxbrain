import { VercelAIToolSet } from 'composio-dev-track';

class ToolsetManager {
  private static instance: VercelAIToolSet | null = null;

  static getToolset(): VercelAIToolSet {
    if (!this.instance) {
      this.instance = new VercelAIToolSet({
        apiKey: process.env.COMPOSIO_API_KEY,
      });
    }
    return this.instance;
  }
}

export { ToolsetManager };