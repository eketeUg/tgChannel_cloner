import { Controller } from '@nestjs/common';
import { TelegramClientService } from './telegram-client.service';

@Controller('telegram-client')
export class TelegramClientController {
  constructor(private readonly telegramClientService: TelegramClientService) {}

  //   @Get('listen')
  //   async listen(@Query('channel') channel: string) {
  //     await this.telegramClientService.listenToChannel(channel);
  //     return { status: 'listening', channel };
  //   }
}
