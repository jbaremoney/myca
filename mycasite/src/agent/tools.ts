import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { extractBase64FromDataUrl } from './utils'
import { McpSession } from "./agentComms";
import axios from 'axios';


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

let currentUserPrompt: string | null = null;

export function setCurrentUserPrompt(prompt: string | null) {
  currentUserPrompt = prompt;
}

export function getCurrentUserPrompt(): string | null {
  return currentUserPrompt;
}


export interface MycaCall {
    query: string
    top_k?: number
    modality?: string
    // optionally add more stuff we want to pass to myca
}

export interface MycaResp {
    url: string
    code: number
}

// TODO: maybe change url endpoint? mcp route name doesn't make sense
const MYCA_URL = "https://aofbnauuix32ebcof5guv5nxai0mblkm.lambda-url.us-east-1.on.aws/route"

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
        "x-api-key": "dev-key"
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

export function createGetHelperTool() {
  return tool(
    async () => {
      const query = getCurrentUserPrompt() ?? "";

      console.log("=== GET_HELPER_TOOL INVOKED ===");
      console.log("Raw user query:", query);
      console.log("Has image:", !!currentImageBase64);

      lastToolPrompt = query;

      try {
        const mycaCallPayload = {
          query,
          top_k: 1,
          modality: currentImageBase64 ? "Image" : "Text",
        };

        const mycaResp = await callMyca(mycaCallPayload);
        console.log("MYCA response:", mycaResp);

        if (mycaResp.code >= 400) {
          throw new Error("Myca returned an error");
        }

        if (mycaResp.code >= 300 || !mycaResp.url) {
          throw new Error("No matching agent found");
        }

        const mcpSession = new McpSession(mycaResp.url);
        await mcpSession.initialize();

        currentHelperSession = mcpSession;

        const args: Record<string, unknown> = {};
        if (currentImageBase64) {
          args.img = extractBase64FromDataUrl(currentImageBase64);
        }

        const result = await mcpSession.callJobTool(args);
        return result;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown error occurred";
        console.error("MCP call failed:", errorMsg);

        return {
          error: "MCP call failed",
          message: errorMsg,
        };
      }
    },
    {
      name: "call_myca",
      description:
        "Route the current user request to the correct helper agent and complete the helper tool call using the literal user message.",
      schema: z.object({}),
    }
  );
}



export function createCallHelperTool() {
  return tool(
    async ({ inArgs }: { inArgs?: Record<string, unknown> }) => {
      if (!currentHelperSession) {
        throw new Error("No active helper session. Call get_helper first.");
      }

      const mergedArgs: Record<string, unknown> = { ...(inArgs ?? {}) };

      if (currentImageBase64 && mergedArgs.img == null) {
        mergedArgs.img = extractBase64FromDataUrl(currentImageBase64);
      }

      const result = await currentHelperSession.callJobTool(mergedArgs);
      return result;
    },
    {
      name: "call_helper",
      description:
        "Call the currently selected helper agent. If an image was uploaded, it will be passed automatically as img.",
      schema: z.object({
        inArgs: z.record(z.string(), z.unknown()).optional(),
      }),
    }
  );
}