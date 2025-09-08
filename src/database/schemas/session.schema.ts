import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type SessionDocument = mongoose.HydratedDocument<Session>;

@Schema()
export class Session {
  @Prop({ required: true, unique: true })
  chatId: number;

  @Prop()
  messageId: number;

  @Prop()
  channel: string;

  @Prop()
  targetChannel: string;

  @Prop()
  channelId: string;

  @Prop()
  targetChannelId: string;

  @Prop({ default: false })
  promptChannel: boolean;

  @Prop({ default: false })
  promptTargetChannel: boolean;

  @Prop()
  inputChannelPromptId: number[];

  @Prop()
  userInputId: number[];

  @Prop()
  transactionId: string;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
