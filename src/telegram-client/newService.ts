import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage } from 'telegram/events';
// If you need the event type, import it like this:
import { NewMessageEvent } from 'telegram/events/NewMessage';
import { BotService } from 'src/bot/bot.service';

@Injectable()
export class TelegramClientService implements OnModuleInit {
  private client: TelegramClient;
  private isListening = false;
  private lastMessageId: number | null = null;
  private logger = new Logger(TelegramClientService.name);
  private clonerBot = this.botService.clonerBot;

  // Cache for albums
  private albumCache: { [key: string]: any[] } = {};

  constructor(private readonly botService: BotService) {}

  async onModuleInit() {
    const apiId = parseInt(process.env.TG_API_ID, 10);
    const apiHash = process.env.TG_API_HASH;
    const stringSession = new StringSession(process.env.TG_SESSION || ''); // load saved session

    this.client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });

    this.client = new TelegramClient(stringSession, apiId, apiHash, {
      connectionRetries: 5,
    });

    await this.client.start({
      phoneNumber: async () => process.env.TG_PHONE!,
      password: async () => process.env.TG_2FA_PASSWORD || '',
      phoneCode: async () => {
        console.log('Enter the code you received:');
        return new Promise<string>((resolve) => {
          process.stdin.once('data', (data) => resolve(data.toString().trim()));
        });
      },
      onError: (err) => console.error(err),
    });

    console.log('Connected to Telegram!');
    console.log('Session:', this.client.session.save());

    // 👇 Listen for new messages in ANY chat
    this.client.addEventHandler(
      this.onNewMessage.bind(this),
      new NewMessage({}),
    );

    if (!this.isListening) {
      this.client.addEventHandler(
        this.onNewMessage.bind(this),
        new NewMessage({}),
      );
      this.isListening = true;
    }
  }

  private async onNewMessage(event: NewMessageEvent) {
    const msg = event.message;
    console.log('Received message:', msg);

    // Filter only channel messages
    if (
      msg.isChannel &&
      msg.chatId?.toString() != '-100244686966' &&
      msg.id !== this.lastMessageId
    ) {
      console.log('📢 New channel post:');
      console.log('Channel ID:', msg.chatId?.toString());
      console.log('Message ID:', msg.id);
      console.log('Text:', msg.message);
      console.log('Date:', msg.date);
      await this.handleChannelPost(msg);
      this.lastMessageId = msg.id; // Prevent duplicate processing
    }
  }

  handleChannelPost = async (msg: any) => {
    this.logger.debug(msg);
    try {
      const channelId = process.env.CHANNEL_ID;
      if (msg.media) {
        console.log('Media message detected');
        const fileId = msg.media.document?.id || msg.media.photo?.[0]?.id;
        if (fileId) {
          const fileLink = await this.clonerBot.getFileLink(fileId);
          const caption = msg.message || '';
          return await this.clonerBot.sendDocument(channelId, fileLink, {
            caption,
            parse_mode: 'HTML',
          });
        }
      }
      return await this.clonerBot.sendMessage(channelId, msg.message, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      console.error(error);
    }
  };

  //   handleChannelPost = async (msg: any) => {
  //     this.logger.debug(msg);
  //     try {
  //       const channelId = process.env.CHANNEL_ID;

  //       if (msg.media_group_id) {
  //         console.log('Album detected');

  //         if (!this.albumCache[msg.media_group_id]) {
  //           this.albumCache[msg.media_group_id] = [];
  //         }

  //         this.albumCache[msg.media_group_id].push(msg);

  //         // Telegram may deliver albums as multiple updates quickly.
  //         // Wait a short time before processing.
  //         setTimeout(async () => {
  //           const group = this.albumCache[msg.media_group_id];
  //           if (!group) return;

  //           // Ensure we only process once
  //           delete this.albumCache[msg.media_group_id];

  //           const mediaGroup: any[] = [];
  //           for (const m of group) {
  //             if (!m.photo && !m.document && !m.video) continue;

  //             let type: 'photo' | 'video' | 'document' = 'photo';
  //             let fileId: string | undefined;

  //             if (m.photo) {
  //               fileId = m.photo[m.photo.length - 1].file_id;
  //               type = 'photo';
  //             } else if (m.video) {
  //               fileId = m.video.file_id;
  //               type = 'video';
  //             } else if (m.document) {
  //               fileId = m.document.file_id;
  //               type = 'document';
  //             }

  //             if (fileId) {
  //               mediaGroup.push({
  //                 type,
  //                 media: fileId,
  //                 caption: m.caption || undefined, // only one will have caption
  //                 parse_mode: 'HTML',
  //               });
  //             }
  //           }

  //           if (mediaGroup.length > 0) {
  //             await this.clonerBot.sendMediaGroup(channelId, mediaGroup);
  //           }
  //         }, 500); // wait 0.5s for all parts to arrive

  //         return;
  //       }

  //       // --- Case 2: Single Media ---
  //       if (msg.photo || msg.video || msg.document) {
  //         console.log('Single media message detected');

  //         let type: 'photo' | 'video' | 'document' = 'photo';
  //         let fileId: string | undefined;

  //         if (msg.photo) {
  //           fileId = msg.photo[msg.photo.length - 1].file_id;
  //           type = 'photo';
  //         } else if (msg.video) {
  //           fileId = msg.video.file_id;
  //           type = 'video';
  //         } else if (msg.document) {
  //           fileId = msg.document.file_id;
  //           type = 'document';
  //         }

  //         if (fileId) {
  //           if (type === 'photo') {
  //             return await this.clonerBot.sendPhoto(channelId, fileId, {
  //               caption: msg.caption || '',
  //               parse_mode: 'HTML',
  //             });
  //           }
  //           if (type === 'video') {
  //             return await this.clonerBot.sendVideo(channelId, fileId, {
  //               caption: msg.caption || '',
  //               parse_mode: 'HTML',
  //             });
  //           }
  //           if (type === 'document') {
  //             return await this.clonerBot.sendDocument(channelId, fileId, {
  //               caption: msg.caption || '',
  //               parse_mode: 'HTML',
  //             });
  //           }
  //         }
  //       }

  //       // --- Case 3: Plain Text ---
  //       if (msg.text) {
  //         return await this.clonerBot.sendMessage(channelId, msg.text, {
  //           parse_mode: 'HTML',
  //         });
  //       }
  //     } catch (error) {
  //       console.error(error);
  //     }
  //   };

  // Optional: Subscribe to a specific channel by username
  //   async listenToChannel(channel: string) {
  //     const entity = await this.client.getEntity(channel);
  //     this.client.addEventHandler(
  //       this.onNewMessage.bind(this),
  //       new NewMessage({ chats: [entity.id] }),
  //     );
  //     console.log(`👂 Listening to posts from ${channel}`);
  //   }
}

//   media: {
//     CONSTRUCTOR_ID: 1389939929,
//     SUBCLASS_OF_ID: 1198308914,
//     className: 'MessageMediaDocument',
//     classType: 'constructor',
//     flags: 1,
//     nopremium: false,
//     spoiler: false,
//     video: false,
//     round: false,
//     voice: false,
