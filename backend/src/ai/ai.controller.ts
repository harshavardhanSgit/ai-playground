import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';
import { text } from 'stream/consumers';

@Controller('ai')
export class AiController {
    constructor(private readonly aiService: AiService) { }
    @Post('chat')
    chat(@Body() body: { message: string }) {
        return this.aiService.chat(body.message);
    }

    @Post('chat/stream')
    chatStream(@Body() body: { message: string }, @Res() res: Response,) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        return this.aiService.chatStream(body.message,res);
    }
}
