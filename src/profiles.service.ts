import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { CreateProfileDto } from './dto/createProfile.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Profile } from './profiles.entity';
import { Repository } from 'typeorm';
import { lastValueFrom } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
// TODO: Pagination
@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @Inject('TO_AUTH_MS') private toAuthProxy: ClientProxy,
  ) {}
  checkForError(obj) {
    const exception = obj.exception;
    if (exception) {
      throw new HttpException(exception.message, exception.statusCode);
    }
  }
  async createUser(dto: LoginDto) {
    return await lastValueFrom(
      this.toAuthProxy.send({ cmd: 'createUser' }, { dto }),
    );
  }

  async updateUser(userId: number, dto: LoginDto) {
    return await lastValueFrom(
      this.toAuthProxy.send({ cmd: 'updateUser' }, { userId, dto }),
    );
  }

  async deleteUser(userId: number) {
    await lastValueFrom(
      this.toAuthProxy.send({ cmd: 'deleteUser' }, { userId }),
    );
  }
  async getRepository() {
    return this.profileRepository;
  }
  async registration(dto: CreateProfileDto) {
    // Создание учетных данных (User) для профиля
    const userCreateResult = await this.createUser(dto);
    this.checkForError(userCreateResult);
    const userId = userCreateResult.user.id;

    // Создание профиля
    const profileInsertResult = await this.profileRepository.insert({
      ...dto,
      userId,
    });
    const createdProfileId = profileInsertResult.raw[0].id;
    //TODO: нужно ли делать еще один запрос?
    const createdProfile = await this.getProfileById(createdProfileId);
    return { profile: createdProfile, tokens: userCreateResult.tokens };
  }

  async login(dto: LoginDto) {
    const loginResult = await lastValueFrom(
      this.toAuthProxy.send({ cmd: 'login' }, { dto }),
    );
    this.checkForError(loginResult);
    return loginResult;
  }

  async logout(refreshToken: string) {
    return await lastValueFrom(
      this.toAuthProxy.send({ cmd: 'logout' }, { refreshToken }),
    );
  }

  async refresh(refreshToken: string) {
    const refreshResult = await lastValueFrom(
      this.toAuthProxy.send({ cmd: 'refresh' }, { refreshToken }),
    );
    this.checkForError(refreshResult);
    return refreshResult;
  }
  async activate(activationLink: string) {
    await this.toAuthProxy.send({ cmd: 'activate' }, { activationLink });
  }

  async getAllProfiles(): Promise<Profile[]> {
    return await this.profileRepository.find();
  }

  async deleteProfile(id: number): Promise<Profile> {
    try {
      const profile = await this.profileRepository.findOneBy({ id });
      const userId = profile.userId;
      const deleteResult = await this.profileRepository.delete({ id });
      if (userId) {
        await this.deleteUser(userId);
      }

      return deleteResult.raw;
    } catch (e) {
      throw new HttpException('Пользователь не найден', HttpStatus.NOT_FOUND);
    }
  }

  async updateProfile(
    id: number,
    dto: CreateProfileDto,
    avatar: string,
  ): Promise<Profile> {
    try {
      // Изменение данных профиля
      const updateProfileDto: UpdateProfileDto = { ...dto };
      delete updateProfileDto['password'];
      delete updateProfileDto['email'];
      await this.profileRepository.update(
        { id },
        { ...updateProfileDto, avatar },
      );

      // Изменение учетных данных (User)
      const profile = await this.profileRepository.findOneBy({ id });
      const userId = profile.userId;
      if (dto.password || dto.email) {
        await this.updateUser(userId, dto);
      }

      return await this.profileRepository.findOne({
        where: { id },
      });
    } catch (e) {
      throw new HttpException('Пользователь не найден', HttpStatus.NOT_FOUND);
    }
  }
  async getProfileById(id: number): Promise<Profile> {
    const profileData = await this.profileRepository.findOneBy({ id }); //TODO: no result
    if (!profileData) {
      throw new HttpException('Профиль не найден', HttpStatus.NOT_FOUND);
    }
    return profileData;
  }
  async getProfileByUserId(userId: number): Promise<Profile> {
    const profileData = await this.profileRepository.findOneBy({ userId });
    if (!profileData) {
      throw new HttpException('Профиль не найден', HttpStatus.NOT_FOUND);
    }
    return profileData;
  }
}
