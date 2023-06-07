import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { Repository } from 'typeorm';
import { Profile } from './profiles.entity';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeORMTestingModule } from './test-utils/TypeORMTestingModule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { CreateProfileDto } from './dto/createProfile.dto';
import { DeleteResult, UpdateResult } from 'typeorm';
import { HttpModule } from '@nestjs/axios';

describe('profiles Controller', () => {
  let controller: ProfilesController;
  let service: ProfilesService;
  let repository: Repository<Profile>;

  beforeAll(async () => {
    const profilesModule: TestingModule = await Test.createTestingModule({
      imports: [
        HttpModule,
        ConfigModule.forRoot({
          envFilePath: `.${process.env.NODE_ENV}.env`,
        }),

        TypeORMTestingModule([Profile]),
        TypeOrmModule.forFeature([Profile]),
        ClientsModule.registerAsync([
          {
            name: 'TO_ROLES_MS',
            useFactory: (configService: ConfigService) => ({
              transport: Transport.RMQ,
              options: {
                urls: [configService.get<string>('RMQ_URL')],
                queue: 'toRolesMs',
                queueOptions: {
                  durable: false,
                },
              },
            }),
            inject: [ConfigService],
            imports: [ConfigModule],
          },
        ]),
        ClientsModule.registerAsync([
          {
            name: 'TO_AUTH_MS',
            useFactory: (configService: ConfigService) => ({
              transport: Transport.RMQ,
              options: {
                urls: [configService.get<string>('RMQ_URL')],
                queue: 'toAuthMs',
                queueOptions: {
                  durable: false,
                },
              },
            }),
            inject: [ConfigService],
            imports: [ConfigModule],
          },
        ]),
      ],
      providers: [ProfilesService],
      controllers: [ProfilesController],
    }).compile();

    controller = profilesModule.get<ProfilesController>(ProfilesController);
    service = profilesModule.get<ProfilesService>(ProfilesService);
    repository = await service.getRepository();

    const app = profilesModule.createNestApplication();
    const connection = repository.manager.connection;
    await connection.synchronize(true);
    await app.init();

    jest.spyOn(service, 'deleteUser').mockImplementation(async () => {
      return new DeleteResult();
    });
    jest.spyOn(service, 'createUser').mockImplementation(async () => {
      return {
        user: {
          id: 1,
          isActivated: false,
          activationLink: '82b72f42-60a3-4aee-b6fa-01f54bad01d0',
          password: '',
          vkId: 0,
          email: '',
          oauthProviders: [],
        },

        accessToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGVzIjpbXSwiaWF0IjoxNjg1NDgwOTM4LCJleHAiOjE2ODU0ODA5NTN9.VRNK2Oc8P8mFvlrm3sIBQnnwXKDxI90kiPlK8M-KPOE',
        refreshToken:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGVzIjpbXSwiaWF0IjoxNjg1NDgwOTM4LCJleHAiOjE2ODU0ODA5Njh9.6OLXKQbebGHcoXJkuJe__wKE9l7C-U6QSIlv8ryLYhg',
      };
    });

    jest.spyOn(service, 'updateUser').mockImplementation(async () => {
      return new UpdateResult();
    });
  });
  describe('profiles CRUD', () => {
    it('create new profile with correct properties', async () => {
      const createProfileDto: CreateProfileDto = {
        nickName: 'test_nickname',
        firstName: 'test_firstname',
        lastName: 'test_lastname',
        phone: 'test_phone',
        password: 'test_password',
        email: 'test_email@mail.com',
        vkId: null,
        provider: 'local',
      };

      const registrationResult = await controller.registration({
        registrationDto: createProfileDto,
      });
      const profileId = registrationResult.profile.id;
      const profileFromDb = await repository.findOneBy({ id: profileId });
      expect(profileFromDb.userId).toBeDefined();
      expect(profileFromDb.firstName).toEqual(createProfileDto.firstName);
      expect(profileFromDb.lastName).toEqual(createProfileDto.lastName);
      expect(profileFromDb.phone).toEqual(createProfileDto.phone);
    });
    it('update profile', async () => {
      const createProfileDto: CreateProfileDto = {
        nickName: 'test_nickname',
        firstName: 'test_firstname',
        lastName: 'test_lastname',
        phone: 'test_phone',
        password: 'test_password',
        email: 'test_email2@mail.com',
        vkId: null,
        provider: 'local',
      };
      const registrationResult = await controller.registration({
        registrationDto: createProfileDto,
      });
      const profileId = registrationResult.profile.id;

      const updateProfileDto: CreateProfileDto = {
        nickName: 'test_nickname',
        firstName: 'updated_firstname',
        lastName: 'updated_lastname',
        phone: 'updated_phone',
        password: 'test_password',
        email: 'test_email2@mail.com',
        vkId: null,
        provider: 'local',
      };
      await controller.updateProfile({
        profileId,
        updateProfileDto,
        avatarFileName: null,
      });
      const profileFromDb = await repository.findOneBy({ id: profileId });
      expect(profileFromDb.userId).toBeDefined();
      expect(profileFromDb.firstName).toEqual(updateProfileDto.firstName);
      expect(profileFromDb.lastName).toEqual(updateProfileDto.lastName);
      expect(profileFromDb.phone).toEqual(updateProfileDto.phone);
    });
    it('delete profile', async () => {
      const createProfileDto: CreateProfileDto = {
        nickName: 'test_nickname',
        firstName: 'test_firstname',
        lastName: 'test_lastname',
        phone: 'test_phone',
        password: 'test_password',
        email: 'test4_email2@mail.com',
        vkId: null,
        provider: 'local',
      };
      const registrationResult = await controller.registration({
        registrationDto: createProfileDto,
      });
      const profileId = registrationResult.profile.id;

      await controller.delete({ profileId });
      const existingProfile = await repository.findOneBy({ id: profileId });
      expect(existingProfile).toBeNull();
    });
    it('get profile by id', async () => {
      const createProfileDto: CreateProfileDto = {
        nickName: 'test_nickname',
        firstName: 'test_firstname',
        lastName: 'test_lastname',
        phone: 'test_phone',
        password: 'test_password',
        email: 'test5_email2@mail.com',
        vkId: null,
        provider: 'local',
      };
      const registrationResult = await controller.registration({
        registrationDto: createProfileDto,
      });
      const profileId = registrationResult.profile.id;

      const profileFromDb = await controller.getProfileById({ profileId });
      expect(profileFromDb.userId).toBeDefined();
      expect(profileFromDb.firstName).toEqual(createProfileDto.firstName);
      expect(profileFromDb.lastName).toEqual(createProfileDto.lastName);
      expect(profileFromDb.phone).toEqual(createProfileDto.phone);
    });
  });
});
