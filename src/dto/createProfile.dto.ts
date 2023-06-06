export class CreateProfileDto {
  readonly nickName: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string;
  readonly password: string;
  readonly email: string;
  readonly provider: string;
  readonly vkId: number;
}
