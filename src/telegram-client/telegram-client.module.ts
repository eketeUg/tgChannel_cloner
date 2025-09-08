import { forwardRef, Module } from '@nestjs/common';
import { TelegramClientService } from './telegram-client.service';
import { TelegramClientController } from './telegram-client.controller';
import { BotModule } from 'src/bot/bot.module';

@Module({
  imports: [forwardRef(() => BotModule)],
  providers: [TelegramClientService],
  controllers: [TelegramClientController],
  exports: [TelegramClientService],
})
export class TelegramClientModule {}
