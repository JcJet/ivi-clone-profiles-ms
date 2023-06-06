export class CreateUserResultDto {
  user: {
    id: number;
    email: string;
    password: string;
    isActivated: boolean;
    activationLink: string;
    vkId: number;
    oauthProviders: any[];
  };
  tokens: { accessToken: string; refreshToken: string };
}
