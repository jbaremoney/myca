import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { createGetHelperTool, createCallHelperTool, setCurrentImage, setCurrentUserPrompt } from "./tools";
// export interface Message {
//   role: "user" | "assistant";
//   content: string;
// }

export interface AgentInfo {
  dataset?: string;
  agentName?: string;
  predictedLabel?: string;
  classIndex?: number;
  probabilities?: Record<string, number>;
  disclaimer?: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  agentInfo?: AgentInfo | null;
}

function safeParseJson(value: unknown): any | null {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function extractText(content: unknown): string {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as any).text ?? "");
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function extractAgentInfoFromToolMessage(msg: any): AgentInfo | null {
  if (!msg || msg.type !== "tool") return null;
  if (msg.name !== "call_myca") return null;

  const parsed = safeParseJson(msg.content);
  if (!parsed) return null;

  const sc = parsed.structuredContent;
  if (!sc) return null;

  return {
    dataset: sc.dataset,
    agentName: sc.agent_name,
    predictedLabel: sc.predicted_label,
    classIndex: sc.class_index,
    probabilities: sc.probabilities,
    disclaimer: sc.disclaimer,
  };
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
      tools: [createGetHelperTool(), createCallHelperTool()],
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
    setCurrentUserPrompt(prompt);

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

  //USE THIS CODE TO DEBUG WHAT MESSAGES THE AGENT IS SEEING AND RESPONDING WITH - IT INCLUDES ALL MESSAGES INCLUDING TOOL CALLS
  // getMessages(): Message[] {
  //   if (!this.lastState) return [];

  //   return this.lastState.messages.map((msg) => ({
  //     role: msg.getType() === "human" ? "user" : "assistant",
  //     content:
  //       typeof msg.content === "string"
  //         ? msg.content
  //         : JSON.stringify(msg.content),
  //   }));
  // }

  //USE THIS CODE TO ONLY SEE THE MESSAGES BETWEEN THE USER AND AGENT, NOT INCLUDING TOOL CALLS
  // getMessages(): Message[] {
  //   if (!this.lastState) return [];

  //   return this.lastState.messages
  //     .filter((msg) => {
  //       return msg.type === "human" || msg.type === "ai";
  //     })
  //     .map((msg) => ({
  //       role: msg.type === "human" ? "user" : "assistant",
  //       content:
  //         typeof msg.content === "string"
  //           ? msg.content
  //           : JSON.stringify(msg.content),
  //     }));
  // }
  getMessages(): Message[] {
    if (!this.lastState) return [];

    const visibleMessages: Message[] = [];

    for (let i = 0; i < this.lastState.messages.length; i++) {
      const msg: any = this.lastState.messages[i];

      if (msg.type === "human") {
        visibleMessages.push({
          role: "user",
          content: extractText(msg.content),
          agentInfo: null,
        });
      }

      if (msg.type === "ai") {
        const previousMsg = i > 0 ? this.lastState.messages[i - 1] : null;
        const agentInfo = extractAgentInfoFromToolMessage(previousMsg);

        visibleMessages.push({
          role: "assistant",
          content: extractText(msg.content),
          agentInfo,
        });
      }
    }

    return visibleMessages.filter(
      (msg) => Boolean(msg.content || msg.agentInfo)
    );
  }

  getLastImage(): string | null {
    return this.lastImage;
  }
}
