import { Controller } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Profile } from './profiles.entity';
import { CreateProfileDto } from './dto/createProfile.dto';
import { LoginDto } from './dto/login.dto';

@Controller()
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
  ) {}

  @MessagePattern('registration')
  async registration(@Payload() data: { dto: CreateProfileDto }) {
    return await this.profilesService.registration(data.dto);
  }

  @MessagePattern('login')
  async login(@Payload() data: { dto: LoginDto }): Promise<{ token: string }> {
    return await this.profilesService.login(data.dto);
  }

  @MessagePattern('logout')
  async logout(@Payload() data: { refreshToken: string }) {
    return await this.profilesService.logout(data.refreshToken);
  }
  @MessagePattern('refresh')
  async refresh(@Payload() data: { refreshToken: string }) {
    return await this.profilesService.refresh(data.refreshToken);
  }

  @MessagePattern('activate')
  async activate(@Payload() data: { activationLink: string }) {
    return await this.profilesService.activate(data.activationLink);
  }
  @MessagePattern('getAllProfiles')
  async getAllUsers(): Promise<Profile[]> {
    return await this.profilesService.getAllProfiles();
  }

  @MessagePattern('updateProfile')
  async update(
    @Payload()
    data: {
      id: number;
      dto: CreateProfileDto;
      avatarFileName: string;
    },
  ): Promise<Profile> {
    return await this.profilesService.updateProfile(
      data.id,
      data.dto,
      data.avatarFileName,
    );
  }

  @MessagePattern('deleteProfile')
  async delete(@Payload() data: { id: number }): Promise<Profile> {
    return await this.profilesService.deleteProfile(data.id);
  }

  @MessagePattern('getProfileById')
  async getById(@Payload() data: { id: number }) {
    return await this.profilesService.getProfileById(data.id);
  }
}
