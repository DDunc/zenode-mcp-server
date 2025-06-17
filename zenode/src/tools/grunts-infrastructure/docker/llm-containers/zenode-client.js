/**
 * Zenode Client - Real communication with zenode MCP tools
 */

const axios = require('axios');

class ZenodeClient {
  constructor() {
    this.mcpUrl = process.env.ZENODE_MCP_URL || 'http://host.docker.internal:3000/mcp';
    this.workspacePath = process.env.WORKSPACE_PATH || '/workspace';
  }

  async callZenodeTool(toolName, params) {
    try {
      console.log(`📡 Calling zenode:${toolName} via MCP`);
      
      const response = await axios.post(this.mcpUrl, {
        method: 'tools/call',
        params: {
          name: `zenode__${toolName}`,
          arguments: params
        }
      }, {
        timeout: 120000, // 2 minutes timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return response.data.result;
    } catch (error) {
      console.error(`❌ Zenode ${toolName} call failed:`, error.message);
      throw error;
    }
  }

  async gopher(action, params) {
    return await this.callZenodeTool('gopher', {
      action: action,
      ...params
    });
  }

  async analyze(files, prompt) {
    return await this.callZenodeTool('analyze', {
      files: files,
      prompt: prompt,
      analysis_type: 'quality',
      model: 'auto'
    });
  }

  async testgen(files, prompt) {
    return await this.callZenodeTool('testgen', {
      files: files,
      prompt: prompt,
      model: 'auto'
    });
  }

  async thinkdeep(prompt, problemContext) {
    return await this.callZenodeTool('thinkdeep', {
      prompt: prompt,
      problem_context: problemContext,
      thinking_mode: 'medium',
      model: 'auto'
    });
  }

  async codereview(files, prompt) {
    return await this.callZenodeTool('codereview', {
      files: files,
      prompt: prompt,
      review_type: 'full',
      model: 'auto'
    });
  }

  async debug(prompt, files, errorContext) {
    return await this.callZenodeTool('debug', {
      prompt: prompt,
      files: files || [],
      error_context: errorContext,
      model: 'auto'
    });
  }
}

module.exports = ZenodeClient;