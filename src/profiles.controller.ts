import {Controller, UseFilters} from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Profile } from './profiles.entity';
import { CreateProfileDto } from './dto/createProfile.dto';
import { LoginDto } from './dto/login.dto';
import { HttpExceptionFilter } from './http-exception.filter';

@Controller()
@UseFilters(new HttpExceptionFilter())
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
  ) {}

  @MessagePattern({ cmd: 'registration' })
  async registration(@Payload() data: { registrationDto: CreateProfileDto }) {
    return await this.profilesService.registration(data.registrationDto);
  }

  @MessagePattern({ cmd: 'login' })
  async login(
    @Payload() data: { loginDto: LoginDto },
  ): Promise<{ token: string }> {
    return await this.profilesService.login(data.loginDto);
  }

  @MessagePattern({ cmd: 'logout' })
  async logout(@Payload() data: { refreshToken: string }) {
    return await this.profilesService.logout(data.refreshToken);
  }
  @MessagePattern({ cmd: 'refreshAccessToken' })
  async refresh(@Payload() data: { refreshToken: string }) {
    return await this.profilesService.refresh(data.refreshToken);
  }

  @MessagePattern({ cmd: 'activate' })
  async activate(@Payload() data: { activationLink: string }) {
    return await this.profilesService.activate(data.activationLink);
  }
  @MessagePattern({ cmd: 'getAllProfiles' })
  async getAllProfiles(): Promise<Profile[]> {
    return await this.profilesService.getAllProfiles();
  }

  @MessagePattern({ cmd: 'updateProfile' })
  async updateProfile(
    @Payload()
    data: {
      profileId: number;
      updateProfileDto: CreateProfileDto;
      avatarFileName: string;
    },
  ): Promise<Profile> {
    return await this.profilesService.updateProfile(
      data.profileId,
      data.updateProfileDto,
      data.avatarFileName,
    );
  }

  @MessagePattern({ cmd: 'deleteProfile' })
  async delete(@Payload() data: { profileId: number }): Promise<Profile> {
    return await this.profilesService.deleteProfile(data.profileId);
  }

  @MessagePattern({ cmd: 'getProfileById' })
  async getProfileById(@Payload() data: { profileId: number }) {
    return await this.profilesService.getProfileById(data.profileId);
  }
  @MessagePattern({ cmd: 'getProfileByUserId' })
  async getProfileByUserId(@Payload() data: { userId: number }) {
    return await this.profilesService.getProfileByUserId(data.userId);
  }
  @MessagePattern({ cmd: 'loginVk' })
  async loginVk(@Payload() data: { code: string }) {
    return this.profilesService.loginVk(data.code);
  }
}
