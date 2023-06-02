import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { CreateProfileDto } from './dto/createProfile.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Profile } from './profiles.entity';
import { Repository } from 'typeorm';
import { lastValueFrom } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { HttpService } from '@nestjs/axios';
import process from 'process';
import { ConfigService } from '@nestjs/config';
// TODO: Pagination
@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @Inject('TO_AUTH_MS') private toAuthProxy: ClientProxy,
    private httpService: HttpService,
    private configService: ConfigService,
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
    const nickName = dto.nickName || dto.email.split('@')[0];

    // Создание профиля
    const profileInsertResult = await this.profileRepository.insert({
      ...dto,
      userId,
      nickName,
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
    console.log(id);
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

  async loginVk(code: string) {
    let authData;
    console.log(code);
    try {
      authData = await this.getVkToken(code);
    } catch (e) {
      throw new HttpException('Неверный код VK', HttpStatus.UNAUTHORIZED);
    }

    const user = await lastValueFrom(
      this.toAuthProxy.send(
        { cmd: 'getUser' },
        { email: authData.data.email, vkId: authData.data.user_id },
      ),
    );

    if (user) {
      return this.login({
        email: user.email,
        password: user.password,
        provider: 'VK',
      });
    }
    try {
      const { data } = await this.getUserDataFromVk(
        authData.data.user_id,
        authData.data.access_token,
      );

      const profileVk = data.response[0];

      const createProfileDto: CreateProfileDto = {
        vkId: authData.data.user_id,
        email: authData.data.email,
        password: '',
        firstName: profileVk.first_name,
        lastName: profileVk.last_name,
        provider: 'VK',
        phone: '',
        nickName: profileVk.first_name,
      };
      console.log(authData.data);
      await this.registration(createProfileDto);

      return this.login(createProfileDto);
    } catch (e) {
      throw new HttpException(
        'Ошибка при обращении к VK',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  async getVkToken(code: string): Promise<any> {
    const vkData = {
      client_id: this.configService.get('VK_APP_ID'),
      client_secret: this.configService.get('VK_SECRET'),
    };
    const redirectUri =
      this.configService.get('API_URL') + '/profile/vk_redirect/';
    const link = `https://oauth.vk.com/access_token?client_id=${vkData.client_id}&client_secret=${vkData.client_secret}&redirect_uri=${redirectUri}&code=${code}`;
    return await lastValueFrom(this.httpService.get(link));
  }
  async getUserDataFromVk(userId: string, token: string): Promise<any> {
    return await lastValueFrom(
      this.httpService.get(
        `https://api.vk.com/method/users.get?user_ids=${userId}&fields=photo_400,has_mobile,home_town,contacts,mobile_phone&access_token=${token}&v=5.120`,
      ),
    );
  }
}
