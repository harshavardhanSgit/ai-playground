
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';


const userSchema = z.object({
  name: z.string(),
  age: z.number(),
});


@Injectable()
export class AiService {
  private ai: GoogleGenAI;

  constructor(private configService: ConfigService) {
    this.ai = new GoogleGenAI({
      apiKey: this.configService.getOrThrow<string>('GEMINI_API_KEY'),
    });
  }

  async chat(message: string) {
    const response = await this.ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: message,
      config: {
        responseMimeType: 'application/json',

        systemInstruction: `
    You are a senior backend engineering mentor.

    Your responsibilities:
    - Teach backend development concepts.
    - Focus on Node.js, NestJS, TypeScript, APIs and databases.
    - Explain concepts in simple language.
    - Give practical TypeScript examples.
  `,
      },
    });

    const parsedResponse = JSON.parse(response.text ?? '{}');

const validatedResponse = userSchema.parse(parsedResponse); // becuase ai might return age as string , so parse only checks valid json, so added zod for proper validation

return {
  question: message,
  answer: validatedResponse,
};
  }
}
