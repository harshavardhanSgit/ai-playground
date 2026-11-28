import { Body, Controller, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import type { } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AiService } from './ai.service';
import type { Content } from '@google/genai';
import { PDFParse } from 'pdf-parse';

@Controller('ai')
export class AiController {
    constructor(private readonly aiService: AiService) { }
    @Post('chat')
    chat(
        @Body() body: {
            message: string; history?: Content[];
        },
    ) {
        return this.aiService.chat(body.message, body.history ?? []);
    }

    @Post('chat/stream')
    chatStream(@Body() body: { message: string }, @Res() res: Response,) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        return this.aiService.chatStream(body.message, res);
    }

    @Post('document')
    @UseInterceptors(FileInterceptor('file'))
    async uploadDocument(@UploadedFile() file: Express.Multer.File) {
        const parser = new PDFParse({
            data: file.buffer,
        });

        try {
            const result = await parser.getText();

            console.log('Extracted PDF text:', result.text);

            return {
                message: 'PDF text extracted successfully',
                fileName: file.originalname,
                extractedText: result.text,
            };
        } finally {
            await parser.destroy();
        }
    }
}
