import { Controller, Get, Query } from '@nestjs/common';
import { TelegramClientService } from './telegram-client.service';

@Controller('telegram-client')
export class TelegramClientController {
  constructor(private readonly telegramClientService: TelegramClientService) {}

  @Get('listen')
  async listen(@Query('channel') channel: string) {
    const channelId =
      await this.telegramClientService.getChat_or_Channel_Id(channel);
    return { channelId: channelId };
  }
}
