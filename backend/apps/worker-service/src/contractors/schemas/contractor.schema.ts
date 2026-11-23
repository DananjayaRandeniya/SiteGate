import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class Contractor {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: Date, default: null })
  deletedAt!: Date | null;
}

export type ContractorDocument = HydratedDocument<Contractor>;

export const ContractorSchema = SchemaFactory.createForClass(Contractor);

ContractorSchema.index({ deletedAt: 1, name: 1 });
