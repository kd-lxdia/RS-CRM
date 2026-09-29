import OpenAI from 'openai';

export type LLMChunkCallback = (textChunk: string) => void;

export class OpenRouterLLM {
  private openai: OpenAI;
  private messageHistory: { role: 'system' | 'user' | 'assistant', content: string }[];
  private isMock: boolean;
  
  constructor(systemPrompt: string, customApiKey?: string) {
    const apiKey = customApiKey || process.env.OPENROUTER_API_KEY || '';
    this.isMock = !apiKey || apiKey === 'dummy_key';
    
    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey || 'dummy_key',
      defaultHeaders: {
        'HTTP-Referer': process.env.FRONTEND_URL || 'http://localhost:3000',
        'X-Title': 'Slar CRM Voice AI',
      },
    });
    
    this.messageHistory = [
      { role: 'system', content: systemPrompt }
    ];
  }

  async processUserUtterance(text: string, onChunk: LLMChunkCallback): Promise<string> {
    this.messageHistory.push({ role: 'user', content: text });
    
    if (this.isMock) {
      // Mock response for testing
      const mockResponses = [
        "Thank you for your interest in solar panels! I'd be happy to help you. Could you tell me about your monthly electricity bill?",
        "That's great! Solar panels can significantly reduce your electricity costs. Do you own the property where you'd like to install them?",
        "Excellent! Based on your bill, you could save around 80% on electricity costs. When would you like to proceed with the installation?",
        "Perfect! We offer government subsidies up to 40% and flexible payment options. Would you like to schedule a free site survey?",
      ];
      
      const response = mockResponses[Math.min(this.messageHistory.length - 2, mockResponses.length - 1)];
      
      // Simulate streaming
      for (let i = 0; i < response.length; i += 5) {
        const chunk = response.slice(i, i + 5);
        onChunk(chunk);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      this.messageHistory.push({ role: 'assistant', content: response });
      return response;
    }
    
    try {
      const stream = await this.openai.chat.completions.create({
        model: 'meta-llama/llama-3.1-8b-instruct', // Removed :free suffix
        messages: this.messageHistory,
        stream: true,
        temperature: 0.7,
        max_tokens: 200, // Keep responses concise for voice
      });

      let fullResponse = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          onChunk(content);
        }
      }

      this.messageHistory.push({ role: 'assistant', content: fullResponse });
      return fullResponse;
      
    } catch (error: any) {
      console.error('OpenRouter LLM Error:', error.response?.data || error.message || error);
      const fallbackMsg = "I apologize, I'm having trouble connecting right now. Could you please repeat that?";
      onChunk(fallbackMsg);
      this.messageHistory.push({ role: 'assistant', content: fallbackMsg });
      return fallbackMsg;
    }
  }
  
  getHistory() {
    return this.messageHistory;
  }
}
