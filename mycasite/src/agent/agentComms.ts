import axios from "axios";

const MCP_PROTOCOL_VERSION = "2024-11-05";

export type JsonSchemaObject = {
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

function parseMcpAxiosResponse(data: unknown) {
  if (typeof data === "object" && data !== null) {
    return data as Record<string, unknown>;
  }

  if (typeof data !== "string") {
    throw new Error("MCP response was neither JSON nor string");
  }

  const lines = data.split(/\r?\n/);
  let dataBuf = "";

  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataBuf += line.slice(5).trim();
    }
  }

  if (!dataBuf) {
    throw new Error(`No data: line found in MCP SSE response: ${data}`);
  }

  return JSON.parse(dataBuf);
}

// stateful MCP session
export class McpSession {
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
          "Accept": "application/json, text/event-stream",
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
          "content-type": "application/json",
          "accept": "application/json, text/event-stream",
          "mcp-protocol-version": this.protocolVersion,
          ...(this.sessionId ? { "mcp-session-id": this.sessionId } : {}),
        },
        responseType: "text",
      }
    );

    console.log("FULL MCP RESPONSE:", response.data);

    const parsed = parseMcpAxiosResponse(response.data);

    if (!("result" in parsed) || !parsed.result) {
      throw new Error(
        "Invalid MCP response: " + JSON.stringify(parsed, null, 2)
      );
    }

    const result = parsed.result as { tools?: McpTool[] };

    if (!result.tools) {
      throw new Error(
        "MCP result missing tools: " + JSON.stringify(parsed, null, 2)
      );
    }

    return result.tools;
  }

  // return the main doJob tool as AgentJobTool object
  async getJobTool(): Promise<AgentJobTool> {
    const tools = await this.listTools();

    const tool = tools.find((t) => t.name === "classify");

    if (!tool) {
      throw new Error("Agent does not expose classify");
    }

    return {
      name: "classify",
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
    };
  }

  async callJobTool(args: Record<string, unknown>) {
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
          "content-type": "application/json",
          "accept": "application/json, text/event-stream",
          "mcp-protocol-version": this.protocolVersion,
          ...(this.sessionId ? { "mcp-session-id": this.sessionId } : {}),
        },
        responseType: "text",
      }
    );

    const parsed = parseMcpAxiosResponse(response.data);

    if (!("result" in parsed) || !parsed.result) {
      throw new Error(
        "Invalid MCP tools/call response: " + JSON.stringify(parsed, null, 2)
      );
    }

    return parsed.result;
  }
}
