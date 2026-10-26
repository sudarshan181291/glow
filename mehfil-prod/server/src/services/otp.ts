import type { FastifyBaseLogger } from 'fastify';

export interface OtpSender { send(phone: string, code: string): Promise<void> }

/** Development: write the code to the server log. Never used in production (config enforces). */
export class ConsoleOtp implements OtpSender {
  constructor(private log: FastifyBaseLogger) {}
  async send(phone: string, code: string) { this.log.warn({ phone }, `DEV OTP for ${phone}: ${code}`); }
}

/** MSG91 OTP (India DLT-compliant template). https://docs.msg91.com */
export class Msg91Otp implements OtpSender {
  constructor(private authKey: string, private templateId: string) {}
  async send(phone: string, code: string) {
    const mobile = phone.replace(/^\+/, '');
    const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(this.templateId)}&mobile=${mobile}&otp=${code}`;
    const res = await fetch(url, { method: 'POST', headers: { authkey: this.authKey, 'content-type': 'application/json' }, body: '{}' });
    if (!res.ok) throw new Error(`MSG91 error ${res.status}: ${await res.text()}`);
  }
}
