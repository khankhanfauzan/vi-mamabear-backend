import { env } from 'prisma/config';
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'pino-nestjs';
import { v4 as uuidv4 } from 'uuid';

@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          genReqId: (req) => req.headers['x-request-id'] || uuidv4(),
          // level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
          level: config.get('LOG_LEVEL') || 'info',

          autoLogging: {
            ignore: (req) => req.url === '/health',
          },

          customSuccessMessage: (req, res) => {
            return `${req.method} ${req.url} ${res.statusCode}`;
          },

          customErrorMessage: (req, res, err) => {
            return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
          },

          customLogLevel: (req, res, err) => {
            if (res.statusCode >= 500 || err) return 'error';
            if (res.statusCode >= 400) return 'warn';
            return 'info';
          },

          serializers: {
            req: (req) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
            res: (res) => ({
              statusCode: res.statusCode,
            }),
          },

          redact: {
            paths: ['req.headers.authorization', 'req.body.password'],
            remove: true,
          },

          transport: {
            targets: [
              {
                target: 'pino-pretty',
                options: {
                  translateTime: 'SYS:standard',
                  singleLine: true,
                  colorize: true,
                  ignore: 'pid,hostname',
                },
              },
              {
                target: 'pino-roll',
                options: {
                  file: './logs/app',
                  frequency: 'daily',
                  mkdir: true,
                  dateFormat: 'yyyy-MM-dd',
                  extension: '.log',
                  size: '10m',
                },
              },
            ],
          },
        },
      }),
    }),
  ],
  exports: [LoggerModule],
})
export class CustomLoggerModule {}
