// Live video via LiveKit (cloud or self-hosted).
//  - Stage room "stage-<studioId>": dancers on stage publish camera+mic, everyone else subscribes.
//  - Private room "room-<bookingId>": dancer + customer publish; a moderator can join hidden.
import { AccessToken, RoomServiceClient, TrackSource, WebhookReceiver, type WebhookEvent } from 'livekit-server-sdk';

export interface VideoService {
  url: string;
  token(o: { room: string; identity: string; name: string; publish: boolean; hidden?: boolean; ttlSec?: number }): Promise<string>;
  createRoom(room: string, maxParticipants: number): Promise<void>;
  deleteRoom(room: string): Promise<void>;
  removeParticipant(room: string, identity: string): Promise<void>;
  receiveWebhook(body: string, auth: string | undefined): Promise<WebhookEvent>;
}

export const stageRoom = (studioId: string) => `stage-${studioId}`;
export const privateRoom = (bookingId: string) => `room-${bookingId}`;

export class LiveKitVideo implements VideoService {
  private rooms: RoomServiceClient;
  private hooks: WebhookReceiver;
  constructor(public url: string, private key: string, private secret: string) {
    this.rooms = new RoomServiceClient(url.replace(/^ws/, 'http'), key, secret);
    this.hooks = new WebhookReceiver(key, secret);
  }

  async token(o: { room: string; identity: string; name: string; publish: boolean; hidden?: boolean; ttlSec?: number }) {
    const at = new AccessToken(this.key, this.secret, { identity: o.identity, name: o.name, ttl: o.ttlSec ?? 60 * 60 });
    at.addGrant({
      room: o.room,
      roomJoin: true,
      canSubscribe: true,
      canPublish: o.publish,
      canPublishData: false,
      canPublishSources: o.publish ? [TrackSource.CAMERA, TrackSource.MICROPHONE] : [],
      hidden: !!o.hidden,
    });
    return at.toJwt();
  }

  async createRoom(room: string, maxParticipants: number) {
    await this.rooms.createRoom({ name: room, emptyTimeout: 120, maxParticipants });
  }
  async deleteRoom(room: string) {
    try { await this.rooms.deleteRoom(room); } catch { /* already gone */ }
  }
  async removeParticipant(room: string, identity: string) {
    try { await this.rooms.removeParticipant(room, identity); } catch { /* not in room */ }
  }
  receiveWebhook(body: string, auth: string | undefined) {
    return this.hooks.receive(body, auth);
  }
}
