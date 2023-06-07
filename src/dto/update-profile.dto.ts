import { CreateProfileDto } from './createProfile.dto';

export class UpdateProfileDto {
  constructor(dto: CreateProfileDto) {
    this.nickName = dto.nickName;
    this.firstName = dto.firstName;
    this.phone = dto.phone;
    this.lastName = dto.lastName;
  }

  readonly nickName: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
}
