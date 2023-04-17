import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ProfileDto } from './dto/profile.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Profile } from './profiles.entity';
import { Repository } from 'typeorm';
import { lastValueFrom } from 'rxjs';
import { AUTH_SERVICE, USERS_SERVICE } from './constants/services';
import { ClientProxy } from '@nestjs/microservices';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @Inject(USERS_SERVICE) private usersClient: ClientProxy,
    @Inject(AUTH_SERVICE) private authClient: ClientProxy,
  ) {}

  async registration(dto: ProfileDto): Promise<Profile> {
    // Создание учетных данных (User) для профиля
    const userCreateResult = await lastValueFrom(
      this.authClient.send('create_user', { dto }),
    );
    const userId = userCreateResult.User.id;

    // Создание профиля
    const profileInsertResult = await this.profileRepository.insert({
      ...dto,
      userId,
    });
    const createdProfileId = profileInsertResult.raw[0].id;
    return this.getProfileById(createdProfileId);
  }
  async getProfileById(id: number): Promise<Profile> {
    return await this.profileRepository.findOne({ where: { id } });
  }
  async login(dto: LoginDto) {
    return await lastValueFrom(this.authClient.send('profile_login', { dto }));
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

  async updateProfile(id: number, dto: ProfileDto): Promise<Profile> {
    try {
      // Изменение данных профиля
      await this.profileRepository
        .createQueryBuilder()
        .update()
        .set({
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
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
      throw new HttpException('Пользователь не найден', HttpStatus.NOT_FOUND);
    }
  }
}
