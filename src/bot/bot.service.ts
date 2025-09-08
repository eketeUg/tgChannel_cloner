import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { TelegramClientService } from 'src/telegram-client/telegram-client.service';
import { menuMarkup, welcomeMessageMarkup } from './markups';
import { InjectModel } from '@nestjs/mongoose';
import { Session, SessionDocument } from 'src/database/schemas/session.schema';
import { Model } from 'mongoose';
import { Clone } from 'src/database/schemas/clone.schema';

@Injectable()
export class BotService {
  clonerBot: TelegramBot;
  private logger = new Logger(BotService.name);

  constructor(
    @Inject(forwardRef(() => TelegramClientService))
    private telegramClientService: TelegramClientService,
    @InjectModel(Clone.name) private readonly cloneModel: Model<Clone>,
    @InjectModel(Session.name) private readonly sessionModel: Model<Session>,
  ) {
    const token = process.env.TELEGRAM_TOKEN;
    this.clonerBot = new TelegramBot(token, { polling: true });
    this.clonerBot.on('message', this.handleRecievedMessages);
    this.clonerBot.on('callback_query', this.handleButtonCommands);
  }

  handleRecievedMessages = async (msg: any) => {
    this.logger.debug(msg);
    try {
      if (!msg.text || msg.chat.type !== 'private') {
        return;
      }

      const session = await this.sessionModel.findOne({ chatId: msg.chat.id });

      await this.clonerBot.sendChatAction(msg.chat.id, 'typing');
      const command = msg.text.trim();
      const channelInfo = await this.parseTelegramChannelLink(command);

      const deleteChannelRegex = /^\/start del-([a-zA-Z0-9]+)$/;
      const matchDelete = msg.text.trim().match(deleteChannelRegex);

      if (matchDelete) {
        await this.clonerBot.deleteMessage(msg.chat.id, msg.message_id);
        return await this.removeClonedChannel(matchDelete[1], msg.chat.id);
      }
      if (command === '/start' && msg.chat.type === 'private') {
        const username = `${msg.from.username}`;
        const welcome = await welcomeMessageMarkup(username);

        if (welcome) {
          const replyMarkup = {
            inline_keyboard: welcome.keyboard,
          };
          await this.clonerBot.sendMessage(msg.chat.id, welcome.message, {
            reply_markup: replyMarkup,
            parse_mode: 'HTML',
          });
        }
      } else if (command === '/menu' && msg.chat.type === 'private') {
        return this.sendAllFeature(msg.chat.id);
      } else if (command === '/cancel' && msg.chat.type === 'private') {
        await this.sessionModel.deleteMany({ chatId: msg.chat.id });
        return await this.clonerBot.sendMessage(
          msg.chat.id,
          ' ✅All  active sessions closed successfully',
        );
      } else if (session && session.promptChannel) {
        if (channelInfo.username || channelInfo.link) {
          const channelId =
            await this.telegramClientService.getChat_or_Channel_Id(
              channelInfo.username || channelInfo.link,
            );
          if (!channelId) {
            await this.clonerBot.sendChatAction(msg.chat.id, 'typing');
            return await this.clonerBot.sendMessage(
              msg.chat.id,
              `I couldn't find the channel you mentioned. Please make sure the username or link is correct and that I have access to it.`,
            );
          }
          const botInChannel = await this.checkBotInChannel(channelId.botApiId);
          if (!botInChannel) {
            await this.clonerBot.sendChatAction(msg.chat.id, 'typing');
            await this.clonerBot.sendMessage(
              msg.chat.id,
              `Please make sure to add me to the channel ${channelInfo.username} with  least "Post Messages" permission`,
            );
          }
          session.channel = channelInfo.username;
          session.channelId = channelId.botApiId;
          session.promptChannel = false;
          await session.save();
          await this.clonerBot.sendChatAction(msg.chat.id, 'typing');
          await this.clonerBot.sendMessage(
            msg.chat.id,
            `<b>Channel </b>: ${session.channel}\n<b>Channel ID</b>: ${session.channelId}\n<b>Bot in Channel</b>: ${botInChannel ? '✅' : '❌'}\n\n`,
            {
              parse_mode: 'HTML',
            },
          );
          await this.inputTargetChannelPrompt(msg.chat.id);
          return;
        }
      } else if (session && session.promptTargetChannel) {
        if (channelInfo.username || channelInfo.link) {
          const channelId =
            await this.telegramClientService.getChat_or_Channel_Id(
              channelInfo.username || channelInfo.link,
            );
          if (!channelId) {
            await this.clonerBot.sendChatAction(msg.chat.id, 'typing');
            return await this.clonerBot.sendMessage(
              msg.chat.id,
              `I couldn't find the channel you mentioned. Please make sure the username or link is correct and that I have access to it.`,
            );
          }

          await this.telegramClientService.joinChannelByUsername(
            channelInfo.username,
          );

          session.targetChannel = channelInfo.username;
          session.targetChannelId = channelId.botApiId;
          session.promptTargetChannel = false;
          await session.save();
          await this.clonerBot.sendChatAction(msg.chat.id, 'typing');
          await this.clonerBot.sendMessage(
            msg.chat.id,
            `<b>Channel </b>: ${session.channel}\n<b>Channel ID</b>: ${session.channelId}\n\n`,
            {
              parse_mode: 'HTML',
            },
          );

          await this.clonerBot.sendChatAction(msg.chat.id, 'typing');
          const clone = await this.cloneModel.create({
            cloneId: `${session.channelId}-${session.targetChannelId}`,
            chatId: msg.chat.id,
            channel: session.channel,
            channelId: session.channelId,
            targetChannel: session.targetChannel,
            targetChannelId: session.targetChannelId,
          });
          if (clone) {
            const deleteMessagesPromises = [
              ...session!.userInputId.map((id) =>
                this.clonerBot.deleteMessage(msg.chat.id, id),
              ),
              ...session!.inputChannelPromptId.map((id) =>
                this.clonerBot.deleteMessage(msg.chat.id, id),
              ),
            ];

            // Execute all deletions concurrently
            await Promise.all(deleteMessagesPromises);
            await this.sessionModel.deleteMany({ chatId: msg.chat.id });
            return await this.clonerBot.sendMessage(
              msg.chat.id,
              `Great! I have set up cloning from ${session.targetChannel} to ${session.channel}. I will start cloning posts from the source channel to the target channel. You can use /menu to see other options.`,
              {
                parse_mode: 'HTML',
              },
            );
          }

          return;
        }
      } else {
        await this.clonerBot.sendChatAction(msg.chat.id, 'typing');
        return await this.clonerBot.sendMessage(
          msg.chat.id,
          `I don't recognize that command. Please use /menu to see available options.`,
        );
      }
    } catch (error) {
      console.error(error);
      if (error?.name && error?.code === 11000) {
        await this.clonerBot.sendMessage(
          msg.chat.id,
          'This channel is already being monitored.',
        );
      } else {
        await this.clonerBot.sendMessage(
          msg.chat.id,
          'An error occurred. Please try again later.',
        );
      }
    }
  };

  handleButtonCommands = async (query: any) => {
    this.logger.debug(query);

    let command: string;
    // let userChatId: string;

    function isJSON(str) {
      try {
        JSON.parse(str);
        return true;
      } catch (e) {
        console.log(e);
        return false;
      }
    }

    if (isJSON(query.data)) {
      command = JSON.parse(query.data).command;
      //   userChatId = JSON.parse(query.data).userChatId;
    } else {
      command = query.data;
    }

    const chatId = query.message.chat.id;
    // const userId = query.from.id;

    try {
      let session: SessionDocument;
      switch (command) {
        case '/menu':
          await this.clonerBot.sendChatAction(chatId, 'typing');
          await this.sendAllFeature(chatId);
          return;

        case '/watchChannel':
          await this.clonerBot.sendChatAction(chatId, 'typing');
          await this.sessionModel.deleteMany({ chatId: chatId });
          session = await this.sessionModel.create({
            chatId: chatId,
          });
          if (session) {
            await this.inputChannelClonePrompt(chatId);
            return;
          }

        case '/viewChannels':
          await this.clonerBot.sendChatAction(chatId, 'typing');
          await this.sessionModel.deleteMany({ chatId: chatId });
          return await this.viewClonedChannels(chatId);

        case '/cancel':
          await this.clonerBot.sendChatAction(query.message.chat.id, 'typing');
          await this.sessionModel.deleteMany({ chatId: query.message.chat.id });
          return await this.clonerBot.sendMessage(
            query.message.chat.id,
            ' ✅All  active sessions closed successfully',
          );

        case '/close':
          await this.clonerBot.sendChatAction(query.message.chat.id, 'typing');
          await this.sessionModel.deleteMany({ chatId: chatId });
          return await this.clonerBot.deleteMessage(
            query.message.chat.id,
            query.message.message_id,
          );

        case '/default':
          await this.clonerBot.sendChatAction(chatId, 'typing');
          return await this.clonerBot.sendMessage(query.message.chat.id, ``);

        default:
          await this.clonerBot.sendChatAction(query.message.chat.id, 'typing');
          return await this.clonerBot.sendMessage(
            query.message.chat.id,
            `Error processing data`,
          );
      }
    } catch (error) {
      console.log(error);
    }
  };

  sendAllFeature = async (chatId: any) => {
    try {
      const allFeatures = await menuMarkup();
      if (allFeatures) {
        const replyMarkup = {
          inline_keyboard: allFeatures.keyboard,
        };
        await this.clonerBot.sendMessage(chatId, allFeatures.message, {
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        });
      }
    } catch (error) {
      console.log(error);
    }
  };

  inputTargetChannelPrompt = async (chatId: any) => {
    try {
      await this.clonerBot.sendChatAction(chatId, 'typing');
      const prompt = await this.clonerBot.sendMessage(
        chatId,
        `Please send me the exact username or invite link of the channel you want to clone from. For example, if the channel username is @examplechannel, please send me that exact username.`,
        {
          parse_mode: 'HTML',
        },
      );
      await this.sessionModel.updateOne(
        { chatId: chatId },
        {
          $set: { inputChannelPromptId: prompt.message_id },
          promptTargetChannel: true,
          promptChannel: false,
        },
      );
      return prompt;
    } catch (error) {
      console.log(error);
    }
  };

  inputChannelClonePrompt = async (chatId: any) => {
    try {
      await this.clonerBot.sendChatAction(chatId, 'typing');
      const prompt = await this.clonerBot.sendMessage(
        chatId,
        `Please send me the exact username or invite link of the channel you want to clone to. For example, if the channel username is @examplechannel, please send me that exact username.`,
        {
          parse_mode: 'HTML',
        },
      );
      await this.sessionModel.updateOne(
        { chatId: chatId },
        {
          $set: { inputChannelPromptId: prompt.message_id },
          promptChannel: true,
          promptTargetChannel: false,
        },
      );
      return prompt;
    } catch (error) {
      console.log(error);
    }
  };

  viewClonedChannels = async (chatId: any) => {
    try {
      await this.clonerBot.sendChatAction(chatId, 'typing');
      const channels = await this.cloneModel.find({ chatId: chatId });
      if (channels.length === 0) {
        return await this.clonerBot.sendMessage(
          chatId,
          `You have no cloned channels. Use /menu to add a new channel to clone.`,
        );
      }

      let message = `<b>Your Cloned Channels:</b>\n\n`;
      channels.forEach((channel, index) => {
        message += `<b>${index + 1}.</b> From: ${channel.targetChannel} To: ${channel.channel} --- (<a href="${process.env.BOT_URL}?start=del-${channel._id.toString()}"> delete 🚮</a>)\n`;
      });

      return await this.clonerBot.sendMessage(chatId, message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: 'Close ❌',
                callback_data: JSON.stringify({
                  command: '/close',
                  language: 'english',
                }),
              },
            ],
          ],
        },
      });
    } catch (error) {
      console.log(error);
    }
  };

  parseTelegramChannelLink = async (input: string) => {
    const linkRegex = /(https?:\/\/)?t\.me\/([a-zA-Z0-9_]{5,32})(\/\d+)?/i;
    const usernameRegex = /@([a-zA-Z0-9_]{5,32})/i;

    const linkMatch = input.match(linkRegex);
    const usernameMatch = input.match(usernameRegex);

    const link = linkMatch ? linkMatch[0] : null;
    let username = usernameMatch ? usernameMatch[0] : null;

    // If it's a link, extract username from link
    if (linkMatch && !username) {
      username = `@${linkMatch[2]}`;
    }

    return { link, username };
  };

  checkBotInChannel = async (channelId: string) => {
    try {
      const botInfo = await this.clonerBot.getMe();
      const member = await this.clonerBot.getChatMember(channelId, botInfo.id);

      if (member.status === 'administrator' || member.status === 'member') {
        console.log(`✅ Bot is in the channel as ${member.status}`);
        return true;
      } else {
        console.log(`❌ Bot is not properly added. Status: ${member.status}`);
        return false;
      }
    } catch (err) {
      console.error(`Error: ${err.response?.description || err.message}`);
    }
  };

  async removeClonedChannel(
    id: string,
    chatId: number,
  ): Promise<{ message: string }> {
    const result = await this.cloneModel.findByIdAndDelete({ _id: id }).exec();

    await this.telegramClientService.leaveChannelByUsername(
      result.targetChannel,
    );
    await this.clonerBot.sendMessage(
      chatId,
      `Channel ${result.channel} - ${result.targetChannel} has been removed`,
    );
    return;
  }
}
