import { Injectable } from '@nestjs/common';
import { Socket } from 'node:net';
import { AppConfigService } from '../../platform/config';
import { NotifySmtpPermanentRejectionException, NotifySmtpTransientFailureException } from '@modules/shared/exceptions';
import { NotifySmtpMessage, NotifySmtpPort } from './notify-smtp.contracts';

const CONNECT_TIMEOUT_MS = 5_000;
const COMMAND_TIMEOUT_MS = 10_000;

/**
 * integration.notify.smtp: a plain SMTP client speaking the submission protocol directly over a TCP
 * socket (EHLO, MAIL FROM, RCPT TO, DATA, QUIT), chosen over adding `nodemailer` for the same reason
 * `PlatformEventBus` chose RxJS over `@nestjs/event-emitter` (see that file's comment): this host cannot
 * reliably reach npm to add a fresh dependency, and the protocol this integration needs is a handful of
 * line-based commands, not a library's worth of surface. No dev SMTP host is declared in
 * application-stacks.yaml at this commit (see integration.notify.smtp's own `sandbox` note), so this
 * client's live path only proves anything once `SMTP_HOST` actually names a reachable one.
 *
 * Classification matches br.notify.failure.classified exactly: a connection failure or a 4xx answer at
 * any step is transient (the host might accept a retry); a 5xx answer to RCPT TO is a permanent
 * rejection of the address, thrown as its own exception so `DeliveryService` never has to parse an SMTP
 * status code itself.
 */
@Injectable()
export class NotifySmtpClient extends NotifySmtpPort {
  constructor(private readonly config: AppConfigService) {
    super();
  }

  async send(message: NotifySmtpMessage): Promise<void> {
    const host = this.config.getSmtpHost();
    const port = this.config.getSmtpPort();
    const from = this.config.getSmtpFromAddress();

    const socket = await connect(host, port).catch(error => {
      throw new NotifySmtpTransientFailureException({ reason: String(error) });
    });

    try {
      await expect(socket, /^220/, /^4|^5/);
      await command(socket, `EHLO ${host}`, /^250/);
      await command(socket, `MAIL FROM:<${from}>`, /^250/);
      await rcptTo(socket, message.to);
      await command(socket, 'DATA', /^354/);
      const body = [
        `From: ${from}`,
        `To: ${message.to}`,
        `Subject: ${message.subject}`,
        '',
        message.body,
        '.',
      ].join('\r\n');
      await command(socket, body, /^250/);
      await command(socket, 'QUIT', /^221/).catch(() => undefined);
    } finally {
      socket.destroy();
    }
  }
}

function connect(host: string, port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`connection to ${host}:${port} timed out`));
    }, CONNECT_TIMEOUT_MS);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('error', error => {
      clearTimeout(timer);
      reject(error);
    });
    socket.connect(port, host);
  });
}

function readLine(socket: Socket): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SMTP response timed out')), COMMAND_TIMEOUT_MS);
    const onData = (chunk: Buffer) => {
      clearTimeout(timer);
      socket.off('error', onError);
      resolve(chunk.toString('utf8'));
    };
    const onError = (error: Error) => {
      clearTimeout(timer);
      socket.off('data', onData);
      reject(error);
    };
    socket.once('data', onData);
    socket.once('error', onError);
  });
}

async function expect(socket: Socket, okPattern: RegExp, _failPattern: RegExp): Promise<string> {
  const line = await readLine(socket).catch(error => {
    throw new NotifySmtpTransientFailureException({ reason: String(error) });
  });
  if (!okPattern.test(line)) {
    throw new NotifySmtpTransientFailureException({ reason: line.trim() });
  }
  return line;
}

async function command(socket: Socket, line: string, okPattern: RegExp): Promise<string> {
  socket.write(`${line}\r\n`);
  return expect(socket, okPattern, /^[45]/);
}

/** RCPT TO is the one step whose 5xx means a permanent rejection of the address rather than a transient
 * transport problem - every other non-2xx/3xx answer in this client is treated as transient. */
async function rcptTo(socket: Socket, to: string): Promise<string> {
  socket.write(`RCPT TO:<${to}>\r\n`);
  const line = await readLine(socket).catch(error => {
    throw new NotifySmtpTransientFailureException({ reason: String(error) });
  });
  if (/^250/.test(line)) return line;
  if (/^5\d\d/.test(line)) {
    throw new NotifySmtpPermanentRejectionException({ reason: line.trim() });
  }
  throw new NotifySmtpTransientFailureException({ reason: line.trim() });
}
