import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
import { NewMessageEvent } from 'telegram/events/NewMessage';
import { BotService } from 'src/bot/bot.service';
// import { Api } from 'telegram';

@Injectable()
export class TelegramClientService implements OnModuleInit {
  private client: TelegramClient;
  private isListening = false;
  private lastMessageId: number | null = null;
  private logger = new Logger(TelegramClientService.name);
  private clonerBot = this.botService.clonerBot;

  constructor(private readonly botService: BotService) {}

  async onModuleInit() {
    const apiId = parseInt(process.env.TG_API_ID, 10);
    const apiHash = process.env.TG_API_HASH;
    const stringSession = new StringSession(process.env.TG_SESSION || '');

    this.client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });

    try {
      await this.client.start({
        phoneNumber: async () => process.env.TG_PHONE!,
        password: async () => process.env.TG_2FA_PASSWORD || '',
        phoneCode: async () => {
          this.logger.log('Enter the code you received:');
          return new Promise<string>((resolve) => {
            process.stdin.once('data', (data) =>
              resolve(data.toString().trim()),
            );
          });
        },
        onError: (err) =>
          this.logger.error(`Client start error: ${err.message}`),
      });

      this.logger.log('Connected to Telegram!');
      this.logger.log(`Session: ${this.client.session.save()}`);

      if (!this.isListening) {
        this.client.addEventHandler(
          this.onNewMessage.bind(this),
          new NewMessage({}),
        );
        this.isListening = true;
        this.logger.log('Listening for new messages');
      }
    } catch (error) {
      this.logger.error(
        `Failed to initialize Telegram client: ${error.message}`,
      );
      throw error;
    }
  }

  private async onNewMessage(event: NewMessageEvent) {
    try {
      const msg = event.message;
      console.log(msg);

      console.log(msg.isChannel);
      console.log(msg.id);
      console.log(msg.chatId.toString());

      console.log(process.env.CHANNEL_ID);

      // Filter channel messages, avoid duplicates, and allow the target channel
      if (
        msg.isChannel &&
        msg.id !== this.lastMessageId &&
        msg.chatId?.toString() !== process.env.CHANNEL_ID
      ) {
        this.logger.log(
          `New channel post: ChatID=${msg.chatId}, MessageID=${msg.id}`,
        );
        if (msg.media) {
          // download as Buffer
          const buffer = await this.client.downloadMedia(msg.media);
          console.log('bufferrrr :', buffer);
          if (buffer) {
            console.log('hereee');
            if (msg.media?.className === 'MessageMediaPhoto') {
              return await this.clonerBot.sendPhoto(
                process.env.CHANNEL_ID,
                Buffer.from(buffer),
                { caption: msg.message, parse_mode: 'HTML' },
              );
            } else if (
              msg.media?.className === 'MessageMediaDocument' &&
              msg.media?.video
            ) {
              return await this.clonerBot.sendVideo(
                process.env.CHANNEL_ID,
                Buffer.from(buffer),
                { caption: msg.message, parse_mode: 'HTML' },
              );
            } else if (
              msg.media?.className === 'MessageMediaDocument' &&
              !msg.media?.video &&
              !msg.media?.voice
            ) {
              return await this.clonerBot.sendAnimation(
                process.env.CHANNEL_ID,
                Buffer.from(buffer),
                { caption: msg.message, parse_mode: 'HTML' },
              );
            }
          } else {
            // plain text
            return await this.clonerBot.sendMessage(
              process.env.CHANNEL_ID,
              msg.message,
            );
          }
        } else {
          // plain text
          return await this.clonerBot.sendMessage(
            process.env.CHANNEL_ID,
            msg.message,
            {
              parse_mode: 'HTML',
            },
          );
        }
      }
    } catch (error) {
      console.log(error);
    }
  }
}
