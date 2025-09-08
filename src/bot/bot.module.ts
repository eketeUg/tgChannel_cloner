import { forwardRef, Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { TelegramClientModule } from 'src/telegram-client/telegram-client.module';
import { MongooseModule } from '@nestjs/mongoose';
import { Clone, CloneSchema } from 'src/database/schemas/clone.schema';
import { Session, SessionSchema } from 'src/database/schemas/session.schema';

@Module({
  imports: [
    forwardRef(() => TelegramClientModule),
    MongooseModule.forFeature([
      { name: Clone.name, schema: CloneSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
  ],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
