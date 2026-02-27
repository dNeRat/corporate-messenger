import { IsIn, IsString } from 'class-validator';

export class SetMemberRoleDto {
  @IsString()
  @IsIn(['ADMIN', 'MEMBER'])
  role: 'ADMIN' | 'MEMBER';
}
