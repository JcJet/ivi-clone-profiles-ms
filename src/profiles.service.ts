import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { CreateProfileDto } from './dto/createProfile.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Profile } from './profiles.entity';
import { Repository } from 'typeorm';
import { lastValueFrom } from 'rxjs';
import { AUTH_SERVICE, USERS_SERVICE } from './constants/services';
import { ClientProxy } from '@nestjs/microservices';
import { LoginDto } from './dto/login.dto';
// TODO: Pagination
@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @Inject(USERS_SERVICE) private usersClient: ClientProxy,
    @Inject(AUTH_SERVICE) private authClient: ClientProxy,
  ) {}

  async registration(dto: CreateProfileDto) {
    // Создание учетных данных (User) для профиля
    const userCreateResult = await lastValueFrom(
      this.authClient.send('create_user', { dto }),
    );
    const userId = userCreateResult.user.id;

    // Создание профиля
    const profileInsertResult = await this.profileRepository.insert({
      ...dto,
      userId,
    });
    const createdProfileId = profileInsertResult.raw[0].id;
    const createdProfile = await this.getProfileById(createdProfileId);
    return { profile: createdProfile, tokens: userCreateResult.tokens };
  }
  async getProfileById(id: number): Promise<Profile> {
    return await this.profileRepository.findOne({ where: { id } });
  }
  async login(dto: LoginDto) {
    return await lastValueFrom(this.authClient.send('login', { dto }));
  }

  async logout(refreshToken: string) {
    return await lastValueFrom(
      this.authClient.send('logout', { refreshToken }),
    );
  }

  async refresh(refreshToken: string) {
    return await lastValueFrom(
      this.authClient.send('refresh', { refreshToken }),
    );
  }
  async activate(activationLink: string) {
    await this.authClient.send('activate', { activationLink });
  }

  async getAllProfiles(): Promise<Profile[]> {
    return await this.profileRepository.find();
  }

  async deleteProfile(id: number): Promise<Profile> {
    // TODO: check if this profile id exists
    const profile = await this.profileRepository.findOne({
      where: { id },
    });
    const userId = profile.userId;
    const deleteResult = await this.profileRepository
      .createQueryBuilder()
      .delete()
      .from(Profile)
      .where('id = :id', { id })
      .returning('*')
      .execute();

    if (userId) {
      await lastValueFrom(this.authClient.send('delete_user', { userId }));
    }

    return deleteResult.raw[0];
  }

  async updateProfile(
    id: number,
    dto: CreateProfileDto,
    avatar: string,
  ): Promise<Profile> {
    console.log(avatar);
    try {
      // Изменение данных профиля
      await this.profileRepository
        .createQueryBuilder()
        .update()
        .set({
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          avatar: avatar,
        })
        .where('id = :id', { id })
        .returning('*')
        .execute();
      // Изменение учетных данных (User)
      const profile = await this.profileRepository.findOne({
        where: { id },
      });
      const userId = profile.userId;
      if (dto.login || dto.password || dto.email) {
        await lastValueFrom(
          this.usersClient.send('update_user', { userId, dto }),
        );
      }

      return await this.profileRepository.findOne({
        where: { id },
      });
    } catch (e) {
      throw e;
      throw new HttpException('Пользователь не найден', HttpStatus.NOT_FOUND);
    }
  }
}
