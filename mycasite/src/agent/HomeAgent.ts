import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { createCallMycaTool, setCurrentImage } from "./tools";

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export class HomeAgent {
  private agent: ReturnType<typeof createReactAgent> | null = null;
  private lastState: { messages: BaseMessage[] } | null = null;
  private lastImage: string | null = null;

  initialize(apiKey: string) {
    if (this.agent) return;

    const llm = new ChatOpenAI({
      apiKey,
      model: "gpt-4o",
    });

    this.agent = createReactAgent({
      llm,
      tools: [createCallMycaTool(apiKey)],
    });
  }

  isInitialized(): boolean {
    return this.agent !== null;
  }

  async run(prompt: string, imageBase64?: string): Promise<void> {
    if (!this.agent) {
      throw new Error("HomeAgent not initialized with api key");
    }

    // Store image and set it in tools context
    this.lastImage = imageBase64 || null;
    setCurrentImage(imageBase64 || null);

    // Pass full conversation history so the agent has chat memory.
    // LangGraph updates state during a run but does NOT carry state between invocations
    // unless you use a checkpointer + thread_id — so we pass previous messages here.
    const previousMessages = this.lastState?.messages ?? [];
    
    // Add image reference to prompt if image is provided
    let enhancedPrompt = prompt;
    if (imageBase64) {
      enhancedPrompt = `${prompt}\n\n[User has attached a PNG image to this message]`;
    }

    const state = await this.agent.invoke({
      messages: [...previousMessages, new HumanMessage(enhancedPrompt)],
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

  getLastImage(): string | null {
    return this.lastImage;
  }
}
