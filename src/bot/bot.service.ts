import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';

@Injectable()
export class BotService {
  clonerBot: TelegramBot;
  private logger = new Logger(BotService.name);

  constructor() {
    const token = process.env.TELEGRAM_TOKEN;
    this.clonerBot = new TelegramBot(token, { polling: true });
  }

  //   handleChannelPost = async (msg: any) => {
  //     console.log(msg);
  //     console.log(msg.media.photo.id.value.toString());
  //     console.log(msg.media.photo.fileReference);
  //     try {
  //       const channelId = process.env.CHANNEL_ID;
  //       if (msg.media) {
  //         console.log('Media message detected');
  //         // const fileId = msg.media.document?.id || msg.media.photo?.id?.value;

  //         return await this.clonerBot.sendPhoto(
  //           channelId,
  //           msg.media.photo.fileReference,
  //         );
  //       }
  //       return await this.clonerBot.sendMessage(channelId, msg.message, {
  //         parse_mode: 'HTML',
  //       });
  //     } catch (error) {
  //       console.error(error);
  //     }
  //   };
}
