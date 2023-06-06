import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { CreateProfileDto } from './dto/createProfile.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Profile } from './profiles.entity';
import { DeleteResult, Repository, UpdateResult } from 'typeorm';
import { lastValueFrom } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { logCall } from './decorators/logging-decorator';
import { CreateUserResultDto } from './dto/create-user-result.dto';
@Injectable()
export class ProfilesService implements OnModuleInit {
  constructor(
    @InjectRepository(Profile)
    private profileRepository: Repository<Profile>,
    @Inject('TO_AUTH_MS') private toAuthProxy: ClientProxy,
    @Inject('TO_ROLES_MS') private toRolesProxy: ClientProxy,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    console.log(`The module has been initialized.`);
    const dto: CreateProfileDto = {
      email: 'admin@admin.com',
      firstName: '',
      lastName: '',
      nickName: '',
      password: this.configService.get('POSTGRES_PASSWORD'),
      phone: '',
      provider: 'local',
      vkId: null,
    };
    let userId: number;
    try {
      const registrationResult = await this.registration(dto);
      userId = registrationResult.profile.userId;
      await lastValueFrom(
        this.toRolesProxy.send(
          { cmd: 'createRole' },
          { dto: { value: 'ADMIN', description: 'Admin user' } },
        ),
      );
    } catch (e) {}
    try {
      if (!userId) {
        const user = await lastValueFrom(
          this.toAuthProxy.send(
            { cmd: 'getUser' },
            { email: 'admin@admin.com' },
          ),
        );
        userId = user.id;
      }
      await lastValueFrom(
        this.toRolesProxy.send(
          { cmd: 'addUserRoles' },
          { dto: { userId, roles: ['ADMIN'] } },
        ),
      );
    } catch (e) {}
  }
  @logCall()
  checkForError(obj) {
    const exception = obj.exception;
    if (exception) {
      throw new HttpException(exception.message, exception.statusCode);
    }
  }
  @logCall()
  async createUser(dto: LoginDto): Promise<CreateUserResultDto> {
    return await lastValueFrom(
      this.toAuthProxy.send({ cmd: 'createUser' }, { dto }),
    );
  }
  @logCall()
  async updateUser(userId: number, dto: LoginDto): Promise<UpdateResult> {
    return await lastValueFrom(
      this.toAuthProxy.send({ cmd: 'updateUser' }, { id: userId, dto }),
    );
  }
  @logCall()
  async deleteUser(userId: number): Promise<DeleteResult> {
    return await lastValueFrom(
      this.toAuthProxy.send({ cmd: 'deleteUser' }, { userId }),
    );
  }
  @logCall()
  async getRepository(): Promise<Repository<Profile>> {
    return this.profileRepository;
  }
  @logCall()
  async registration(dto: CreateProfileDto): Promise<{
    profile: Profile;
    accessToken: string;
    refreshToken: string;
  }> {
    // Создание учетных данных (User) для профиля
    const userCreateResult: CreateUserResultDto = await this.createUser(dto);
    this.checkForError(userCreateResult);
    const userId: number = userCreateResult.user.id;
    const nickName: string = dto.nickName || dto.email.split('@')[0];

    // Создание профиля
    const profileInsertResult = await this.profileRepository.insert({
      ...dto,
      userId,
      nickName,
    });
    const createdProfileId = profileInsertResult.raw[0].id;
    //TODO: нужно ли делать еще один запрос?
    const createdProfile: Profile = await this.getProfileById(createdProfileId);
    return {
      profile: createdProfile,
      accessToken: userCreateResult.accessToken,
      refreshToken: userCreateResult.refreshToken,
    };
  }
  @logCall()
  async login(dto: LoginDto): Promise<CreateUserResultDto> {
    const loginResult = await lastValueFrom(
      this.toAuthProxy.send({ cmd: 'login' }, { dto }),
    );
    this.checkForError(loginResult);
    return loginResult;
  }
  @logCall()
  async logout(refreshToken: string): Promise<DeleteResult> {
    return await lastValueFrom(
      this.toAuthProxy.send({ cmd: 'logout' }, { refreshToken }),
    );
  }
  @logCall()
  async refresh(refreshToken: string): Promise<CreateUserResultDto> {
    const refreshResult = await lastValueFrom(
      this.toAuthProxy.send({ cmd: 'refresh' }, { refreshToken }),
    );
    this.checkForError(refreshResult);
    return refreshResult;
  }
  @logCall()
  async activate(activationLink: string): Promise<void> {
    await this.toAuthProxy.send({ cmd: 'activate' }, { activationLink });
  }
  @logCall()
  async getAllProfiles(): Promise<Profile[]> {
    return await this.profileRepository.find();
  }
  @logCall()
  async deleteProfile(id: number): Promise<DeleteResult> {
    try {
      const profile: Profile = await this.profileRepository.findOneBy({ id });
      const userId: number = profile.userId;
      const deleteResult = await this.profileRepository.delete({ id });
      if (userId) {
        await this.deleteUser(userId);
      }

      return deleteResult;
    } catch (e) {
      throw new HttpException('Пользователь не найден', HttpStatus.NOT_FOUND);
    }
  }
  @logCall()
  async updateProfile(
    id: number,
    dto: CreateProfileDto,
    avatar: string,
  ): Promise<UpdateResult> {
    try {
      // Изменение данных профиля
      const updateProfileDto: UpdateProfileDto = { ...dto };
      delete updateProfileDto['password'];
      delete updateProfileDto['email'];
      const profileUpdateResult = await this.profileRepository.update(
        { id },
        { ...updateProfileDto, avatar },
      );

      // Изменение учетных данных (User)
      const profile = await this.profileRepository.findOneBy({ id });
      const userId = profile.userId;
      if (dto.password || dto.email) {
        await this.updateUser(userId, dto);
      }

      return profileUpdateResult;
    } catch (e) {
      throw new HttpException('Пользователь не найден', HttpStatus.NOT_FOUND);
    }
  }
  @logCall()
  async getProfileById(id: number): Promise<Profile> {
    const profileData = await this.profileRepository.findOneBy({ id }); //TODO: no result
    if (!profileData) {
      throw new HttpException('Профиль не найден', HttpStatus.NOT_FOUND);
    }
    return profileData;
  }
  @logCall()
  async getProfileByUserId(userId: number): Promise<Profile> {
    const profileData = await this.profileRepository.findOneBy({ userId });
    if (!profileData) {
      throw new HttpException('Профиль не найден', HttpStatus.NOT_FOUND);
    }
    return profileData;
  }
  @logCall()
  async loginVk(code: string): Promise<CreateUserResultDto> {
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

      await this.registration(createProfileDto);

      return this.login(createProfileDto);
    } catch (e) {
      throw new HttpException(
        'Ошибка при обращении к VK',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  @logCall()
  async getVkToken(code: string): Promise<any> {
    const vkData = {
      client_id: this.configService.get('VK_APP_ID'),
      client_secret: this.configService.get('VK_SECRET'),
    };

    const redirectUri =
      this.configService.get('API_URL') + '/oauth/vk_redirect/';
    const link =
      `https://oauth.vk.com/access_token?client_id=${vkData.client_id}` +
      `&client_secret=${vkData.client_secret}` +
      `&redirect_uri=${redirectUri}&code=${code}`;
    return await lastValueFrom(this.httpService.get(link));
  }
  @logCall()
  async getUserDataFromVk(userId: string, token: string): Promise<any> {
    return await lastValueFrom(
      this.httpService.get(
        `https://api.vk.com/method/users.get?user_ids=${userId}` +
          `&fields=photo_400,has_mobile,home_town,contacts,mobile_phone&access_token=${token}&v=5.120`,
      ),
    );
  }
}
