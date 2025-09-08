import {
  Injectable,
  OnModuleInit,
  Logger,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
import { NewMessageEvent } from 'telegram/events/NewMessage';
import { BotService } from 'src/bot/bot.service';
import { InjectModel } from '@nestjs/mongoose';
import { Clone } from 'src/database/schemas/clone.schema';
import { Model } from 'mongoose';
// import { Api } from 'telegram';

@Injectable()
export class TelegramClientService implements OnModuleInit {
  private client: TelegramClient;
  private isListening = false;
  private lastMessageId: number | null = null;
  private logger = new Logger(TelegramClientService.name);
  private clonerBot = this.botService.clonerBot;

  constructor(
    @Inject(forwardRef(() => BotService))
    private botService: BotService,
    @InjectModel(Clone.name) private readonly cloneModel: Model<Clone>,
  ) {}

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

      const regex = /@[\w\d_]{5,32}|https?:\/\/t\.me\/[\w\d_]+/i;

      if (regex.test(msg.message)) {
        // omit message
        console.log('Message contains username or t.me link, skipping...');
        return;
      } else {
        // process message
        const cloneChannels = await this.cloneModel
          .find({ targetChannelId: msg.chatId.toString() })
          .exec();

        if (cloneChannels.length) {
          for (const clone of cloneChannels) {
            const channelId = clone.channelId;
            const targetChannelId = clone.targetChannelId;

            // Filter channel messages, avoid duplicates, and allow the target channel
            if (
              msg.isChannel &&
              msg.id !== this.lastMessageId &&
              msg.chatId?.toString() === targetChannelId &&
              msg.chatId?.toString() !== channelId
            ) {
              this.logger.log(
                `New channel post: ChatID=${msg.chatId}, MessageID=${msg.id}`,
              );
              if (msg.media) {
                // download as Buffer
                const buffer = await this.client.downloadMedia(msg.media);
                //   console.log('bufferrrr :', buffer);
                if (buffer) {
                  console.log('hereee');
                  if (msg.media?.className === 'MessageMediaPhoto') {
                    return await this.clonerBot.sendPhoto(
                      channelId,
                      Buffer.from(buffer),
                      { caption: msg.message, parse_mode: 'HTML' },
                    );
                  } else if (
                    msg.media?.className === 'MessageMediaDocument' &&
                    msg.media?.video
                  ) {
                    return await this.clonerBot.sendVideo(
                      channelId,
                      Buffer.from(buffer),
                      { caption: msg.message, parse_mode: 'HTML' },
                    );
                  } else if (
                    msg.media?.className === 'MessageMediaDocument' &&
                    !msg.media?.video &&
                    !msg.media?.voice
                  ) {
                    return await this.clonerBot.sendAnimation(
                      channelId,
                      Buffer.from(buffer),
                      { caption: msg.message, parse_mode: 'HTML' },
                    );
                  }
                } else {
                  // plain text
                  return await this.clonerBot.sendMessage(
                    channelId,
                    msg.message,
                  );
                }
              } else {
                // plain text
                return await this.clonerBot.sendMessage(
                  channelId,
                  msg.message,
                  {
                    parse_mode: 'HTML',
                  },
                );
              }
            }
          }
        } else {
          console.log('This channel is NOT being cloned.');
        }
      }
    } catch (error) {
      console.log(error);
    }
  }

  async getChat_or_Channel_Id(
    username: string,
  ): Promise<{ mtprotoId: string; botApiId: string }> {
    try {
      const result = await this.client.invoke(
        new Api.contacts.ResolveUsername({
          username: username.replace('@', ''), // strip @ if included
        }),
      );

      if (result.chats.length > 0) {
        const channel: any = result.chats[0];
        const mtprotoId = channel.id.toString();
        const botApiId = `-100${channel.id.toString()}`;

        this.logger.log(
          `Resolved ${username} → MTProto ID: ${mtprotoId}, Bot API chat_id: ${botApiId}`,
        );

        return { mtprotoId, botApiId };
      } else {
        throw new Error(`No channel found for username ${username}`);
      }
    } catch (error) {
      this.logger.error(`Failed to resolve ${username}`, error);
      throw error;
    }
  }

  /**
   * Join a public channel by username
   */
  async joinChannelByUsername(username: string) {
    try {
      const resolved = await this.client.invoke(
        new Api.contacts.ResolveUsername({
          username: username.replace('@', ''),
        }),
      );

      if (!resolved.chats.length) {
        throw new Error(`Channel ${username} not found`);
      }

      const channel = resolved.chats[0];

      // Check if already joined (for Channel type)
      if ('left' in channel && channel.left === false) {
        this.logger.log(`Already a member of ${username}`);
        return channel;
      }

      // Try joining
      const result = await this.client.invoke(
        new Api.channels.JoinChannel({
          channel: channel,
        }),
      );

      this.logger.log(`Joined channel: ${username}`);
      return result;
    } catch (error: any) {
      if (error.errorMessage === 'USER_ALREADY_PARTICIPANT') {
        this.logger.warn(`Already joined channel ${username}`);
        return { status: 'already_joined' };
      }
      this.logger.error(`Failed to join channel ${username}`, error);
      throw error;
    }
  }

  /**
   * Join a private channel via invite link
   */
  async joinChannelByInviteLink(inviteLink: string) {
    try {
      const hash = inviteLink.split('/').pop();

      const result = await this.client.invoke(
        new Api.messages.ImportChatInvite({ hash }),
      );

      this.logger.log(`Joined channel with invite: ${inviteLink}`);
      return result;
    } catch (error: any) {
      if (error.errorMessage === 'USER_ALREADY_PARTICIPANT') {
        this.logger.warn(`Already joined channel via invite ${inviteLink}`);
        return { status: 'already_joined' };
      }
      if (error.errorMessage === 'INVITE_HASH_EXPIRED') {
        this.logger.warn(`Invite link expired: ${inviteLink}`);
        return { status: 'invite_expired' };
      }
      this.logger.error(`Failed to join via invite link ${inviteLink}`, error);
      throw error;
    }
  }

  async leaveChannelByUsername(username: string) {
    try {
      const resolved = await this.client.invoke(
        new Api.contacts.ResolveUsername({
          username: username.replace('@', ''),
        }),
      );

      if (!resolved.chats.length) {
        throw new Error(`Channel ${username} not found`);
      }

      const channel = resolved.chats[0];

      const result = await this.client.invoke(
        new Api.channels.LeaveChannel({
          channel,
        }),
      );

      this.logger.log(`Left channel: ${username}`);
      return result;
    } catch (error: any) {
      if (error.errorMessage === 'USER_NOT_PARTICIPANT') {
        this.logger.warn(`Not a member of channel ${username}`);
        return { status: 'not_a_member' };
      }
      this.logger.error(`Failed to leave channel ${username}`, error);
      throw error;
    }
  }
}
