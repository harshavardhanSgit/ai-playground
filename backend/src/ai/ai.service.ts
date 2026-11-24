
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Response } from 'express';
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

    const validationResult = userSchema.safeParse(parsedResponse);

    if (!validationResult.success) {
      throw new InternalServerErrorException('AI returned invalid data');
    }

    const validatedResponse = validationResult.data;

    return {
      question: message,
      answer: validatedResponse,
    };
  }

  async chatStream(message: string, res: Response) {
    const response = await this.ai.models.generateContentStream({
      model: 'gemini-3.5-flash-lite',
      contents: message,
    });

    for await (const chunk of response) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify(text)}\n\n`);
      }
    }
    res.end();
  }
}
