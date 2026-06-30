import { Ollama } from "ollama";

import { config } from "../../config";
import { ChatMessage } from "../../types/chat";
import { ChatResponse } from "../../types/chat";
import { LLMProvider } from "../../interfaces/LLMProvider";

export class OllamaProvider implements LLMProvider {
    private client = new Ollama({
        host: config.host
    });

    async chat(messages: ChatMessage[]): Promise<ChatResponse> {

        const response = await this.client.chat({

            model: config.model,

            messages

        });

        return {

            content: response.message.content

        };

    }
}