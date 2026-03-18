import { tool } from "@langchain/core/tools";
import { z } from "zod";

const MYCA_URL =
  "https://aofbnauuix32ebcof5guv5nxai0mblkm.lambda-url.us-east-1.on.aws/route";
const MYCA_API_KEY = "dev-key";

export function createCallMycaTool(apiKey?: string) {
  return tool(
    async ({ query }: { query: string }) => {
      console.log("Calling router:", MYCA_URL);
      console.log("Query:", query);

      const res = await fetch(MYCA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": MYCA_API_KEY,
        },
        body: JSON.stringify({
          query,
          top_k: 3,
          modality: "image",
        }),
      });

      console.log("Res = happened");

      const rawText = await res.text();
      console.log("Router status:", res.status);
      console.log("Router raw response:", rawText);

      if (!res.ok) {
        throw new Error(`Router request failed: ${res.status} ${rawText}`);
      }

      const result = JSON.parse(rawText);

      return JSON.stringify(result);
    },
    {
      name: "call_myca",
      description: "Delegate a question to the MYCA agent network",
      schema: z.object({
        query: z.string().describe("The question to send to MYCA"),
      }),
    }
  );
}