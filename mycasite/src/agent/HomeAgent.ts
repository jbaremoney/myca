import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export class HomeAgent {
  private agent: ReturnType<typeof createReactAgent> | null = null;
  private lastState: { messages: BaseMessage[] } | null = null;

  initialize(apiKey: string) {
    if (this.agent) return;

    const llm = new ChatOpenAI({
      apiKey,
      model: "gpt-4o",
    });

    this.agent = createReactAgent({
      llm,
      tools: [],
    });
  }

  isInitialized(): boolean {
    return this.agent !== null;
  }

  async run(prompt: string): Promise<void> {
    if (!this.agent) {
      throw new Error("HomeAgent not initialized with api key");
    }

    // IMPORTANT: capture returned state
    const state = await this.agent.invoke({
      messages: [new HumanMessage(prompt)],
    });

    this.lastState = state;
  }

  getMessages(): Message[] {
    if (!this.lastState) return [];

    return this.lastState.messages.map((msg) => ({
      role: msg.getType() === "human" ? "user" : "assistant",
      content:
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content),
    }));
  }
}
