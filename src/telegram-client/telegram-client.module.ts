import { Module } from '@nestjs/common';
import { TelegramClientService } from './telegram-client.service';
import { TelegramClientController } from './telegram-client.controller';
import { BotModule } from 'src/bot/bot.module';

@Module({
  imports: [BotModule],
  providers: [TelegramClientService],
  controllers: [TelegramClientController],
})
export class TelegramClientModule {}
