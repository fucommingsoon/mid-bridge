// Bailian LLM Service (OpenAI compatible mode)
// Using DashScope Qwen model for text generation

import { config } from '../config';

// OpenAI compatible endpoint for Qwen
const BAILIAN_LLM_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  requestId: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

class LLMService {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = config.embedding.apiKey; // Use same API key
    this.model = process.env.BAILIAN_LLM_MODEL || 'qwen-plus';
  }

  /**
   * Generate text completion
   */
  async chat(
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      topP?: number;
    }
  ): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('BAILIAN_API_KEY not configured');
    }

    try {
      const response = await fetch(BAILIAN_LLM_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2000,
          top_p: options?.topP ?? 0.9,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        throw new Error(`LLM API error: ${error.error?.message || response.statusText}`);
      }

      const result = (await response.json()) as {
        id: string;
        choices: Array<{
          message: {
            content: string;
          };
        }>;
        usage?: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };

      const content = result.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('LLM returned no content');
      }

      return {
        content,
        requestId: result.id,
        usage: result.usage
          ? {
              promptTokens: result.usage.prompt_tokens,
              completionTokens: result.usage.completion_tokens,
              totalTokens: result.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`LLM request failed: ${String(error)}`);
    }
  }

  /**
   * Generate JSON response
   */
  async generateJSON<T = Record<string, unknown>>(
    prompt: string,
    systemPrompt?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<T> {
    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: prompt,
    });

    const response = await this.chat(messages, {
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 2000,
    });

    // Try to extract JSON from the response
    let jsonStr = response.content;

    // Remove markdown code blocks if present
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to find JSON object in the response
    const jsonObjectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonObjectMatch) {
      jsonStr = jsonObjectMatch[0];
    }

    try {
      return JSON.parse(jsonStr) as T;
    } catch (e) {
      throw new Error(`Failed to parse JSON response: ${jsonStr.substring(0, 200)}...`);
    }
  }
}

// Singleton instance
export const llmService = new LLMService();
