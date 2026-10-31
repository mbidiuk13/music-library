/**
 * @file Unit-тести сервісу S3. Метод `send` клієнта S3 підмінено, тому тести не звертаються
 * до справжнього AWS; pre-signed URL підписується локально фіктивними ключами з tests/setup/env.js.
 */

import { jest } from '@jest/globals';
import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import s3, { getS3Client } from '../src/services/s3.js';

/**
 * Підміняє надсилання команд до S3 і повертає шпигуна для перевірки викликів.
 * @returns {jest.SpiedFunction} шпигун методу `send`.
 */
function mockSend() {
  return jest.spyOn(getS3Client(), 'send').mockResolvedValue({});
}

afterEach(() => jest.restoreAllMocks());

describe('services/s3', () => {
  test('uploadFile: PutObject у бакет S3_BUCKET з ключем і MIME-типом', async () => {
    const send = mockSend();

    await s3.uploadFile({
      key: 'tracks/test.mp3',
      body: Buffer.from('ID3 test'),
      contentType: 'audio/mpeg',
    });

    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'test-bucket',
      Key: 'tracks/test.mp3',
      ContentType: 'audio/mpeg',
    });
  });

  test('deleteFile: DeleteObject з потрібним ключем', async () => {
    const send = mockSend();

    await s3.deleteFile('tracks/test.mp3');

    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({ Bucket: 'test-bucket', Key: 'tracks/test.mp3' });
  });

  test('getPresignedUrl: підписане посилання на 3600 с без запиту до AWS', async () => {
    const send = mockSend();

    const url = new URL(await s3.getPresignedUrl('tracks/test.mp3'));

    expect(send).not.toHaveBeenCalled();
    expect(url.hostname).toBe('test-bucket.s3.eu-north-1.amazonaws.com');
    expect(url.pathname).toBe('/tracks/test.mp3');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('3600');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });
});
