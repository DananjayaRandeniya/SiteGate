import { Injectable } from '@nestjs/common';

@Injectable()
export class AccessServiceService {
  getHello(): string {
    return 'Hello World!';
  }
}
