import { forwardRef, Module } from '@nestjs/common';
import { TelegramClientService } from './telegram-client.service';
import { TelegramClientController } from './telegram-client.controller';
import { BotModule } from 'src/bot/bot.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Clone, CloneSchema } from 'src/database/schemas/clone.schema';

@Module({
  imports: [
    forwardRef(() => BotModule),
    MongooseModule.forFeature([{ name: Clone.name, schema: CloneSchema }]),
  ],
  providers: [TelegramClientService],
  controllers: [TelegramClientController],
  exports: [TelegramClientService],
})
export class TelegramClientModule {}
