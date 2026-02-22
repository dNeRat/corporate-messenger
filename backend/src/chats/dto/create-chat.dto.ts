import { IsArray, IsBoolean, IsInt, IsOptional, IsString, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateChatDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsBoolean()
  isGroup: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @Type(() => Number)
  @IsInt({ each: true })
  memberIds: number[]; // ids пользователей, которых добавляем
}