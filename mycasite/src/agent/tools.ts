import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { extractBase64FromDataUrl } from './utils'
import { McpSession, type JsonSchemaObject } from "./agentComms";

// MCP endpoint configuration
const MCP_URL = "https://wymdcqx7mp.us-east-1.awsapprunner.com/mcp";
const MCP_PROTOCOL_VERSION = "2024-11-05";


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

import axios from 'axios'

export interface MycaCall {
    taskDesc: string
    scoreThresh?: number
    // optionally add more stuff we want to pass to myca
}

export interface MycaResp {
    url: string
    code: number
}

// TODO: maybe change url endpoint? mcp route name doesn't make sense
const MYCA_URL = "https://wymdcqx7mp.us-east-1.awsapprunner.com/mcp"

// agent invokes this function ... so it decides what to pass as arg
// should be strong definition of task to be completed
// just calls myca and returns the metadata needed

let currentHelperSession: McpSession | null = null;

async function callMyca(callPayload: MycaCall): Promise<MycaResp>{

    try {
        // 1. call myca to get endpoint
        const response = await axios.post<MycaResp>(MYCA_URL, callPayload, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    const code = response.data.url?.length ? 201 : 301;
    
    // just return response data even if no one found
    // what does myca return if match score below threshold? 

    return {url: response.data.url, code: code}
 
    }

    // TODO: make codes make sense
    catch (error){
        console.error(error)
        return {url: "", code: 400}
    }

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

export function createGetHelperTool() {
  return tool(
    async ({ query }: { query: string }) => {
      console.log("=== GET_HELPER_TOOL INVOKED ===");
      console.log("Query:", query);
      console.log("Has image:", !!currentImageBase64);

      // Store the prompt that the agent used
      lastToolPrompt = query;

      try {
        // Step 1: Call myca, get myca response
        // build myca call payload
        //FIX THIS
        const mycaCallPayload = {taskDesc: query}
        console.log(`calling myca with payload ${mycaCallPayload}`)
        const mycaResp = await callMyca(mycaCallPayload)
        
        // figure out if we got a url
        // if not return early
        if (mycaResp.code >= 400) {
          throw new Error("Myca returned an error");
        }

        if (mycaResp.code >= 300) {
          throw new Error("No matching agent found");
        }
        const url = mycaResp.url
        
        // Step 2: MCP handshake with helper agent 
        console.log("Initializing MCP handshake");
        const mcpSession = new McpSession(url);
        await mcpSession.initialize(); // sets session id

        // Step 3: Get tool id, schema
        const tool = await mcpSession.getJobTool()
        
        if (tool != null){
          currentHelperSession = mcpSession;
          
          return {
          helperUrl: url,
          toolName: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
          }; // should have schema, etc
        }

        else {
          // didn't find valid tool name, default to first one
          return "NO VALID TOOL NAME"
        }
        
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



export function createCallHelperTool() {
  return tool(
    async ({ inArgs }: { inArgs: JsonSchemaObject }) => {
      if (!currentHelperSession) {
        throw new Error("No active helper session. Call get_helper_interface first.");
      }

      const result = await currentHelperSession.callJobTool(
        inArgs, 

      );

      return result;
    },
    {
      name: "call_helper",
      description: "Call the currently selected helper agent with the provided input arguments.",
      schema: z.object({
        inArgs: z.record(z.string(), z.unknown()).describe(
          "Arguments to pass to the helper tool"
        ),
      }),
    }
  );
}