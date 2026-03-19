import { tool } from "@langchain/core/tools";
import { z } from "zod";

// MCP endpoint configuration
const MCP_URL = "https://wymdcqx7mp.us-east-1.awsapprunner.com/mcp";
const MCP_PROTOCOL_VERSION = "2024-11-05";

// Helper function to generate UUIDs
function generateId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extract raw base64 from data URL
 * Converts "data:image/png;base64,iVBORw0KG..." to "iVBORw0KG..."
 */
function extractBase64FromDataUrl(dataUrl: string): string {
  if (dataUrl.includes(",")) {
    return dataUrl.split(",")[1];
  }
  return dataUrl;
}

// Store for passing image context from HomeAgent to tools
let currentImageBase64: string | null = null;

// Store the actual prompt used by the agent when calling tools
let lastToolPrompt: string | null = null;

export function setCurrentImage(imageBase64: string | null) {
  currentImageBase64 = imageBase64;
}

export function getCurrentImage(): string | null {
  return currentImageBase64;
}

export function getLastToolPrompt(): string | null {
  return lastToolPrompt;
}

/**
 * Helper function to parse SSE (Server-Sent Events) stream and extract first JSON object
 */
async function parseSSEStream(
  response: Response,
  timeout_lines: number = 200
): Promise<Record<string, unknown>> {
  if (!response.body) {
    throw new Error("Response has no readable body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let data_buf = "";
  let lines_seen = 0;
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        throw new Error("SSE stream ended before any JSON was received");
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      // Keep last incomplete line in buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        lines_seen++;
        if (lines_seen > timeout_lines) {
          throw new Error("Timed out waiting for SSE data frame");
        }

        if (!line.trim()) {
          // Blank line separates SSE events
          continue;
        }

        // SSE frames look like: "event: message" or "data: {...}"
        if (line.startsWith("data:")) {
          const chunk = line.slice(5).trim();
          data_buf += chunk;

          try {
            const parsed = JSON.parse(data_buf);
            reader.releaseLock();
            return parsed;
          } catch {
            // Keep buffering
            continue;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Initialize MCP session and return session ID
 */
async function initializeSession(): Promise<string> {
  const initPayload = {
    jsonrpc: "2.0",
    id: generateId(),
    method: "initialize",
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "myca-browser-client", version: "0.0.1" },
    },
  };

  const headers = {
    Accept: "text/event-stream, application/json",
    "Content-Type": "application/json",
    "mcp-protocol-version": MCP_PROTOCOL_VERSION,
  };

  const response = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(initPayload),
  });

  if (response.status >= 400) {
    const body = await response.text();
    throw new Error(
      `Initialize failed: ${response.status}\nHeaders: ${JSON.stringify(Object.fromEntries(response.headers))}\nBody: ${body.slice(0, 500)}`
    );
  }

  const sessionId = response.headers.get("mcp-session-id");
  if (!sessionId) {
    throw new Error("Initialize succeeded but no mcp-session-id header returned");
  }

  // Read the initialization response
  await parseSSEStream(response);

  return sessionId;
}

/**
 * Make RPC call to MCP endpoint and parse SSE response
 */
async function rpcCallSSE(
  sessionId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const headers = {
    Accept: "application/json, text/event-stream",
    "Content-Type": "application/json",
    "mcp-session-id": sessionId,
    "mcp-protocol-version": MCP_PROTOCOL_VERSION,
  };

  const response = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (response.status >= 400) {
    const body = await response.text();
    throw new Error(
      `RPC failed: ${response.status}\nResponse headers: ${JSON.stringify(Object.fromEntries(response.headers))}\nBody preview: ${body.slice(0, 800)}`
    );
  }

  return parseSSEStream(response);
}

export function createCallMycaTool(_apiKey?: string) {
  return tool(
    async ({ query }: { query: string }) => {
      console.log("=== CALL_MYCA_TOOL INVOKED (MCP Protocol) ===");
      console.log("Query:", query);
      console.log("Has image:", !!currentImageBase64);

      // Store the prompt that the agent used
      lastToolPrompt = query;

      try {
        // Step 1: Initialize MCP session
        console.log("Initializing MCP session...");
        const sessionId = await initializeSession();
        console.log("Session ID:", sessionId);

        // Step 2: Call tools/list to see available tools
        console.log("Listing available tools...");
        const toolsListPayload = {
          jsonrpc: "2.0",
          id: generateId(),
          method: "tools/list",
        };
        const toolsResp = await rpcCallSSE(sessionId, toolsListPayload);
        console.log("Available tools:", toolsResp);

        // Step 3: Call tools/call with classify method and image
        if (!currentImageBase64) {
          return JSON.stringify({
            error: "No image provided",
            message: "Image is required for classification",
          });
        }

        console.log("Calling classify tool with image...");
        const cleanBase64 = extractBase64FromDataUrl(currentImageBase64);
        const callPayload = {
          jsonrpc: "2.0",
          id: generateId(),
          method: "tools/call",
          params: {
            name: "classify",
            arguments: {
              img: cleanBase64,
            },
          },
        };

        const classifyResp = await rpcCallSSE(sessionId, callPayload);
        console.log("Classify response:", classifyResp);

        return JSON.stringify({
          source: "mcp_endpoint",
          query,
          response: classifyResp,
          sessionId,
        });
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown error occurred";
        console.error("MCP call failed:", errorMsg);
        return JSON.stringify({
          error: "MCP call failed",
          message: errorMsg,
        });
      }
    },
    {
      name: "call_myca",
      description:
        "Call the MYCA MCP endpoint to classify an image. Handles session initialization, tool listing, and image classification via the MCP protocol. You don't need to know or see anything about the image. Just call the tool.",
      schema: z.object({
        query: z
          .string()
          .describe(
            "The question/query to provide as context for classification"
          ),
      }),
    }
  );
}

