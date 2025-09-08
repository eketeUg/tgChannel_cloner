import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type CloneDocument = mongoose.HydratedDocument<Clone>;

@Schema()
export class Clone {
  @Prop({ required: true, unique: true })
  cloneId: string;

  @Prop({ required: true })
  chatId: number;

  @Prop()
  channel: string;

  @Prop()
  targetChannel: string;

  @Prop()
  channelId: string;

  @Prop()
  targetChannelId: string;
}

export const CloneSchema = SchemaFactory.createForClass(Clone);
