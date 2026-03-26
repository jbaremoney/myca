import axios from "axios";

const MCP_PROTOCOL_VERSION = "2025-03-26";

type JsonSchemaObject = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

export interface McpTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: JsonSchemaObject;
  outputSchema?: JsonSchemaObject;
  annotations?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

interface AgentJobTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

// stateful MCP session
class McpSession {
  url: string;
  sessionId?: string;
  jobTool?: AgentJobTool;
  protocolVersion: string;

  constructor(url: string) {
    this.url = url;
    this.protocolVersion = MCP_PROTOCOL_VERSION;
  }

  // do the initialization
  async initialize(): Promise<void> {
    const payload = {
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "initialize",
      params: {
        protocolVersion: this.protocolVersion,
        capabilities: {},
        clientInfo: {
          name: "home-agent",
          version: "0.0.1",
        },
      },
    };

    // actually make the call within initialization function
    const response = await axios.post(this.url, payload, {
      headers: {
        "Content-Type": "application/json",
        "MCP-Protocol-Version": this.protocolVersion,
        "Accept": "application/json, text/event-stream",
      },
    });

    // extract session id from response
    const sessionId =
      response.headers["mcp-session-id"] ??
      response.headers["Mcp-Session-Id"] ??
      response.headers["MCP-Session-Id"];
    // set it
    if (sessionId) {
      this.sessionId = sessionId;
    }
    // send the initialized notification to the mcp server (required by mcp)
    await axios.post(
      this.url,
      {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      },
      {
        headers: {
          "Content-Type": "application/json",
          "MCP-Protocol-Version": this.protocolVersion,
          ...(this.sessionId ? { "MCP-Session-Id": this.sessionId } : {}),
        },
      }
    );
  }

  async listTools(): Promise<McpTool[]> {
    const response = await axios.post(
      this.url,
      {
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tools/list",
      },
      {
        headers: {
          "Content-Type": "application/json",
          "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
          ...(this.sessionId
            ? { "MCP-Session-Id": this.sessionId }
            : {}),
        },
      }
    );

    return response.data.result.tools;
  }

  // return the main doJob tool as AgentJobTool object
  async getJobTool(): Promise<AgentJobTool> {
    const tools = await this.listTools();

    const tool = tools.find((t) => t.name === "doJob");

    if (!tool) {
      throw new Error("Agent does not expose doJob");
    }

    return {
      name: "doJob",
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    };
  }

  async callJobTool(args: Record<string, unknown>){
    const tool = await this.getJobTool();

    const response = await axios.post(
        this.url,
        {
        jsonrpc: "2.0",
        id: crypto.randomUUID(),
        method: "tools/call",
        params: {
            name: tool.name,
            arguments: args,
        },
        },
        {
        headers: {
            "Content-Type": "application/json",
            "MCP-Protocol-Version": this.protocolVersion,
            ...(this.sessionId ? { "MCP-Session-Id": this.sessionId } : {}),
        },
        }
    );

    return response.data.result;
  }
}
