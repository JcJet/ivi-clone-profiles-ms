import { NestFactory } from '@nestjs/core';
import { ProfilesModule } from './profiles.module';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';

async function bootstrap() {
  const app = await NestFactory.create(ProfilesModule);
  const configService = app.get(ConfigService);
  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [configService.get('RMQ_URL')],
      queue: 'toProfilesMs',
      queueOptions: {
        durable: false,
      },
    },
  });

  await app.startAllMicroservices().then(() => {
    console.log('Profiles MS started.');
    console.log('Application variables:');
    for (const var_name of ['RMQ_URL', 'DB_HOST']) {
      console.log(`${var_name}: ${configService.get(var_name)}`);
    }
  });

  //await app.listen(configService.get('PORT'));
}
bootstrap();
