import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TelegramClientModule } from './telegram-client/telegram-client.module';
import { BotModule } from './bot/bot.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [TelegramClientModule, BotModule, DatabaseModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
