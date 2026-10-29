import { Controller, Get } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { setupSwagger } from './bootstrap';

@Controller('probe')
class ProbeController {
  @Get()
  get(): { ok: boolean } {
    return { ok: true };
  }
}

describe('Swagger production dependency compatibility', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    app = module.createNestApplication();
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => app.close());

  it('serves the generated OpenAPI document as JSON', async () => {
    await request(app.getHttpServer() as Server)
      .get('/api/docs-json')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect((response) => {
        const document = response.body as {
          info: { title: string };
          paths: Record<string, { get: unknown }>;
        };
        expect(document.info.title).toBe('Kế toán & Kiểm toán API');
        expect(document.paths['/probe'].get).toBeDefined();
      });
  });

  it('serializes the same generated routes and metadata as YAML', async () => {
    const response = await request(app.getHttpServer() as Server)
      .get('/api/docs-yaml')
      .expect(200)
      .expect('Content-Type', /yaml/);
    expect(response.text).toContain('openapi: 3.0.0');
    expect(response.text).toContain('title: Kế toán & Kiểm toán API');
    expect(response.text).toContain('/probe:');
    expect(response.text).toContain('operationId: ProbeController_get');
    expect(response.text).toContain('bearer:');
  });
});
