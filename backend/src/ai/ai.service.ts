
import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Type } from '@google/genai';
import type { Content } from '@google/genai';

// Tool 1: Calculate two numbers
function calculate(a: number, b: number) {
  return a * b;
}

// Tool 2: Get user details (currently mock data)
function getUserDetails(userId: number) {
  return {
    id: userId,
    name: 'Harsha',
    email: 'harsha@example.com',
  };
}

@Injectable()
export class AiService {
  private ai: GoogleGenAI;

  constructor(private configService: ConfigService) {
    this.ai = new GoogleGenAI({
      apiKey: this.configService.getOrThrow<string>('GEMINI_API_KEY'),
    });
  }

  async chat(message: string, history: Content[] = []) {
    // 1. Send the user's message and conversation history to Gemini
    const contents: Content[] = [
      ...history,
      {
        role: 'user',
        parts: [{ text: message }],
      },
    ];

    const response = await this.ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents,
      config: {
        systemInstruction: `
          You are a senior backend engineering mentor.

          Your responsibilities:
          - Teach backend development concepts.
          - Focus on Node.js, NestJS, TypeScript, APIs and databases.
          - Explain concepts in simple language.
          - Give practical TypeScript examples.
        `,
        tools: [
          {
            functionDeclarations: [
              {
                name: 'calculate',
                description: 'Multiply two numbers',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    a: {
                      type: Type.NUMBER,
                      description: 'First number',
                    },
                    b: {
                      type: Type.NUMBER,
                      description: 'Second number',
                    },
                  },
                  required: ['a', 'b'],
                },
              },
              {
                name: 'getUserDetails',
                description: 'Get user details using the user ID',
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    userId: {
                      type: Type.NUMBER,
                      description: 'The ID of the user',
                    },
                  },
                  required: ['userId'],
                },
              },
            ],
          },
        ],
      },
    });

    // 2. Check whether Gemini requested a tool
    const modelContent = response.candidates?.[0]?.content;

    const functionCall = modelContent?.parts?.find(
      (part) => part.functionCall,
    )?.functionCall;

    // 3. If Gemini did not request a tool, return its normal answer
    if (!functionCall) {
      const answer = response.text ?? '';

      const finalContent: Content =
        modelContent ?? {
          role: 'model',
          parts: [{ text: answer }],
        };

      return {
        question: message,
        answer,
        history: [...contents, finalContent],
      };
    }

    if (!modelContent) {
      throw new Error('Gemini returned a tool call without model content');
    }

    console.log('Function name:', functionCall.name);
    console.log('Function arguments:', functionCall.args);

    // 4. Execute the requested tool in our NestJS backend
    let functionResponse: {
      name: string;
      response: Record<string, unknown>;
    };

    const args = functionCall.args as Record<string, unknown>;

    if (functionCall.name === 'calculate') {
      const { a, b } = args as { a: number; b: number };

      const result = calculate(a, b);

      console.log('Calculation result:', result);

      functionResponse = {
        name: 'calculate',
        response: { result },
      };
    } else if (functionCall.name === 'getUserDetails') {
      const { userId } = args as { userId: number };

      const result = getUserDetails(userId);

      console.log('User details:', result);

      functionResponse = {
        name: 'getUserDetails',
        response: result,
      };
    } else {
      throw new Error(`Unknown function: ${functionCall.name}`);
    }

    console.log('Function response:', functionResponse);

    // 5. Send the tool execution result back to Gemini
    const finalContents: Content[] = [
      ...contents,
      modelContent,
      {
        role: 'user',
        parts: [{ functionResponse }],
      },
    ];

    const finalResponse = await this.ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: finalContents,
    });

    console.log('Final AI response:', finalResponse.text);

    // 6. Return the final answer and updated conversation history
    const finalModelContent: Content =
      finalResponse.candidates?.[0]?.content ?? {
        role: 'model',
        parts: [{ text: finalResponse.text ?? '' }],
      };

    return {
      question: message,
      answer: finalResponse.text,
      history: [...finalContents, finalModelContent],
    };
  }

  // Streaming
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

  async askDocument(question: string, documentText: string) {
    const prompt = `
    Answer the user's question using the document provided below.

    Document:
    ${documentText}

    Question:
    ${question}

    If the answer is not available in the document,
    clearly say that the document does not contain the answer.
  `;

    const response = await this.ai.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents: prompt,
    });

    return {
      question,
      answer: response.text,
    };
  }

}
