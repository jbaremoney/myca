import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const callMycaTool = tool(
  async ({ query }: { query: string }) => {
    // 🔁 call your MYCA system here
    const result = await fetch("/api/myca", {
      method: "POST",
      body: JSON.stringify({ query }),
    }).then(res => res.json());

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
