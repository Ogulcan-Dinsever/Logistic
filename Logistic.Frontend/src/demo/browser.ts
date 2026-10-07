import { setupWorker } from 'msw/browser';
import { http, delay } from 'msw';
import { connection } from '../config';
import { handleDemoRequest } from './engine';

export const worker = setupWorker(
  http.all(`${connection.baseUrl}/*`, async ({ request }) => {
    await delay(180);
    return handleDemoRequest(request);
  }),
);
