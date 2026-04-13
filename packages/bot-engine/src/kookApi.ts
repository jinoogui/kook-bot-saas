import axios, { type AxiosInstance } from 'axios'
import type { KookApiClient } from '@kook-saas/shared'

const BASE_URL = 'https://www.kookapp.cn/api/v3'

export class KookApi implements KookApiClient {
  private readonly http: AxiosInstance

  constructor(token: string) {
    this.http = axios.create({
      baseURL: BASE_URL,
      headers: { Authorization: `Bot ${token}` },
      timeout: 10000,
    })
  }

  async sendChannelMessage(channelId: string, content: string): Promise<void> {
    await this.http.post('/message/create', {
      type: 1,
      target_id: channelId,
      content,
    })
  }

  async sendKmarkdownMessage(channelId: string, content: string): Promise<void> {
    await this.http.post('/message/create', {
      type: 9,
      target_id: channelId,
      content,
    })
  }

  async sendCardMessage(channelId: string, cards: object[]): Promise<void> {
    await this.http.post('/message/create', {
      type: 10,
      target_id: channelId,
      content: JSON.stringify(cards),
    })
  }

  async replyMessage(channelId: string, msgId: string, content: string): Promise<void> {
    await this.http.post('/message/create', {
      type: 1,
      target_id: channelId,
      content,
      quote: msgId,
    })
  }

  async replyCardMessage(channelId: string, msgId: string, cards: object[]): Promise<void> {
    await this.http.post('/message/create', {
      type: 10,
      target_id: channelId,
      content: JSON.stringify(cards),
      quote: msgId,
    })
  }

  async addRole(guildId: string, userId: string, roleId: string): Promise<void> {
    await this.http.post('/guild-role/grant', {
      guild_id: guildId,
      user_id: userId,
      role_id: roleId,
    })
  }

  async removeRole(guildId: string, userId: string, roleId: string): Promise<void> {
    await this.http.post('/guild-role/revoke', {
      guild_id: guildId,
      user_id: userId,
      role_id: roleId,
    })
  }

  async getChannel(channelId: string): Promise<any> {
    const resp = await this.http.get('/channel/view', {
      params: { target_id: channelId },
    })
    return resp.data?.data
  }

  async getUser(userId: string): Promise<any> {
    const resp = await this.http.get('/user/view', {
      params: { user_id: userId },
    })
    return resp.data?.data
  }

  async getGuild(guildId: string): Promise<any> {
    const resp = await this.http.get('/guild/view', {
      params: { guild_id: guildId },
    })
    return resp.data?.data
  }

  async getGuildMember(guildId: string, userId: string): Promise<any> {
    const resp = await this.http.get('/guild/user-list', {
      params: { guild_id: guildId, user_id: userId },
    })
    return resp.data?.data?.items?.[0]
  }

  async deleteMessage(msgId: string): Promise<void> {
    await this.http.post('/message/delete', { msg_id: msgId })
  }

  async sendDirectMessage(userId: string, content: string): Promise<void> {
    const sessionResp = await this.http.post('/user-chat/create', {
      target_id: userId,
    })
    const chatCode = sessionResp.data?.data?.code
    if (!chatCode) return
    await this.http.post('/direct-message/create', {
      type: 1,
      target_id: userId,
      chat_code: chatCode,
      content,
    })
  }

  async sendDirectCardMessage(userId: string, cards: object[]): Promise<void> {
    const sessionResp = await this.http.post('/user-chat/create', {
      target_id: userId,
    })
    const chatCode = sessionResp.data?.data?.code
    if (!chatCode) return
    await this.http.post('/direct-message/create', {
      type: 10,
      target_id: userId,
      chat_code: chatCode,
      content: JSON.stringify(cards),
    })
  }

  async uploadAsset(fileData: Buffer): Promise<string> {
    const FormData = (await import('form-data')).default
    const form = new FormData()
    form.append('file', fileData, { filename: 'image.png' })

    const resp = await this.http.post('/asset/create', form, {
      headers: form.getHeaders(),
    })
    return resp.data?.data?.url || ''
  }

  async joinVoiceChannel(channelId: string): Promise<any> {
    const resp = await this.http.post('/voice/join', { channel_id: channelId })
    const d = resp.data?.data
    return {
      ip: d.ip,
      port: d.port,
      rtcp_port: d.rtcp_port,
      rtcp_mux: d.rtcp_mux ?? true,
      bitrate: d.bitrate ?? 48000,
      audio_ssrc: String(d.audio_ssrc ?? '1111'),
      audio_pt: String(d.audio_pt ?? '111'),
    }
  }

  async leaveVoiceChannel(channelId: string): Promise<boolean> {
    try {
      await this.http.post('/voice/leave', { channel_id: channelId })
      return true
    } catch {
      return false
    }
  }

  async keepVoiceAlive(channelId: string): Promise<boolean> {
    try {
      await this.http.post('/voice/keep-alive', { channel_id: channelId })
      return true
    } catch {
      return false
    }
  }
}
