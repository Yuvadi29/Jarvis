import { ChatMessage, ChatResponse } from "../types/chat";

export interface LLMProvider {
    chat(message: ChatMessage[]): Promise<ChatResponse>;
}