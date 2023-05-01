import { Controller } from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { Profile } from './profiles.entity';
import { CreateProfileDto } from './dto/createProfile.dto';
import { LoginDto } from './dto/login.dto';
// TODO: ответы возвращать со статусом: {response code: 200, responseText: 'success', responseBody: {}}, ошибки все.
@Controller()
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @MessagePattern('registration')
  async registration(@Payload() data: { dto: CreateProfileDto }): Promise<Profile> {
    return await this.profilesService.registration(data.dto);
  }

  @MessagePattern('login')
  async login(@Payload() data: { dto: LoginDto }): Promise<{ token: string }> {
    return await this.profilesService.login(data.dto);
  }

  @MessagePattern('get_all_profiles')
  async getAllUsers(): Promise<Profile[]> {
    return await this.profilesService.getAllProfiles();
  }

  @MessagePattern('update_profile')
  async update(
    @Payload() data: { id: number; dto: CreateProfileDto; avatarFileName: string },
  ): Promise<Profile> {
    return await this.profilesService.updateProfile(
      data.id,
      data.dto,
      data.avatarFileName,
    );
  }

  @MessagePattern('delete_profile')
  async delete(@Payload() data: { id: number }): Promise<Profile> {
    return await this.profilesService.deleteProfile(data.id);
  }

  @MessagePattern('get_profile_by_id')
  async getById(@Payload() data: { id: number }) {
    return await this.profilesService.getProfileById(data.id);
  }
}
