import { connect } from 'node:net';

/**
 * Starts every run with the e2e API's Redis database empty.
 *
 * <p>The API rate-limits by client IP — five sign-ups an hour, three public
 * requests per five minutes — and every request in a run comes from localhost,
 * so a second run within the window failed on limits the first had used up.
 * scripts/e2e-stack.sh gives the e2e API a Redis database of its own (15);
 * this empties only that one, so the dev server's state in database 0 is never
 * touched.
 *
 * <p>Plain RESP over a socket rather than a Redis client: two commands do not
 * justify a dependency.
 */
const HOST = process.env.E2E_REDIS_HOST ?? 'localhost';
const PORT = Number(process.env.E2E_REDIS_PORT ?? 6379);
const DATABASE = process.env.E2E_REDIS_DB ?? '15';

export default async function globalSetup(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = connect(PORT, HOST);
    let reply = '';
    socket.setTimeout(5_000, () => {
      socket.destroy();
      reject(new Error(`Redis at ${HOST}:${PORT} did not answer — is the e2e stack up?`));
    });
    socket.on('error', reject);
    socket.on('connect', () => socket.write(`SELECT ${DATABASE}\r\nFLUSHDB\r\n`));
    socket.on('data', (chunk) => {
      reply += chunk.toString();
      const lines = reply.split('\r\n').filter(Boolean);
      if (lines.length < 2) return;
      socket.end();
      if (lines.every((line) => line === '+OK')) resolve();
      else reject(new Error(`Could not reset e2e Redis database ${DATABASE}: ${lines.join(' ')}`));
    });
  });
}
