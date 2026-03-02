import { tool } from "@langchain/core/tools";
import { z } from "zod";

const MYCA_URL =
  "https://aofbnauuix32ebcof5guv5nxai0mblkm.lambda-url.us-east-1.on.aws/route";
const MYCA_API_KEY = "dev-key"

export function createCallMycaTool(apiKey: string) {
  return tool(
    async ({ query }: { query: string }) => {
      const result = await fetch(MYCA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": MYCA_API_KEY },
        body: JSON.stringify({ query: query, top_k: 3, modality: "image"}),
      }).then((res) => res.json());

      return result.answer;
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
