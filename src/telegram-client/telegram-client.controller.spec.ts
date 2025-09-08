import { Test, TestingModule } from '@nestjs/testing';
import { TelegramClientController } from './telegram-client.controller';

describe('TelegramClientController', () => {
  let controller: TelegramClientController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramClientController],
    }).compile();

    controller = module.get<TelegramClientController>(TelegramClientController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
