import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMessageDto {
  @IsString()
  @MinLength(1)
  text: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  replyToId?: number;
}
