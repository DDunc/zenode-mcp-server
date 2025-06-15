import { Middleware, MiddlewarePipeline, MiddlewarePhase, ToolContext } from './types.js';

export class DefaultMiddlewarePipeline implements MiddlewarePipeline {
  private middlewares: Middleware[] = [];

  register(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  async executeRequest(context: ToolContext): Promise<void> {
    for (const middleware of this.middlewares) {
      if (!middleware.config.enabled) continue;
      
      const shouldRunOnRequest = 
        middleware.config.phases === MiddlewarePhase.REQUEST ||
        middleware.config.phases === MiddlewarePhase.BOTH;

      if (shouldRunOnRequest && middleware.onRequest) {
        try {
          await middleware.onRequest(context);
        } catch (error) {
          console.error(`Middleware ${middleware.config.name} failed on request:`, error);
          // Continue execution - one middleware failure shouldn't break the chain
        }
      }
    }
  }

  async executeResponse(context: ToolContext, result: any, error?: Error): Promise<void> {
    for (const middleware of this.middlewares) {
      if (!middleware.config.enabled) continue;

      const shouldRunOnResponse = 
        middleware.config.phases === MiddlewarePhase.RESPONSE ||
        middleware.config.phases === MiddlewarePhase.BOTH;

      if (shouldRunOnResponse && middleware.onResponse) {
        try {
          await middleware.onResponse(context, result, error);
        } catch (middlewareError) {
          console.error(`Middleware ${middleware.config.name} failed on response:`, middlewareError);
          // Continue execution - one middleware failure shouldn't break the chain
        }
      }
    }
  }
}