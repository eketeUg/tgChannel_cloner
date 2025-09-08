import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TelegramClientModule } from './telegram-client/telegram-client.module';
import { BotModule } from './bot/bot.module';

@Module({
  imports: [TelegramClientModule, BotModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
