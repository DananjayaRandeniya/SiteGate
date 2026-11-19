import { Test, TestingModule } from '@nestjs/testing';
import { AccessServiceController } from './access-service.controller';
import { AccessServiceService } from './access-service.service';

describe('AccessServiceController', () => {
  let accessServiceController: AccessServiceController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AccessServiceController],
      providers: [AccessServiceService],
    }).compile();

    accessServiceController = app.get<AccessServiceController>(AccessServiceController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(accessServiceController.getHello()).toBe('Hello World!');
    });
  });
});
