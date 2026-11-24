import { Global, Module } from '@nestjs/common';
import { ENV, env } from './env.js';

@Global()
@Module({
  providers: [{ provide: ENV, useValue: env }],
  exports: [ENV],
})
export class AppConfigModule {}
