import { spawn, type ChildProcess } from 'child_process'
import type { PluginContext } from '@kook-saas/shared'

export enum PlayStatus {
  STOP = 0,
  WAIT = 1,
  SKIP = 2,
  END = 3,
  PLAYING = 10,
}

export interface StreamInfo {
  ip: string
  port: number
  rtcp_port: number
  rtcp_mux: boolean
  bitrate: number
  audio_ssrc: number
  audio_pt: number
}

export class AudioPlayerService {
  private players = new Map<string, PipelinePlayer>()

  constructor(private ctx: PluginContext) {}

  getPlayer(guildId: string): PipelinePlayer | undefined {
    return this.players.get(guildId)
  }

  async createPlayer(guildId: string, channelId: string): Promise<PipelinePlayer | null> {
    try {
      const result = await this.ctx.kookApi.joinVoiceChannel(channelId)
      if (!result?.data) {
        this.ctx.logger.error('加入语音频道失败')
        return null
      }
      const streamInfo: StreamInfo = {
        ip: result.data.ip,
        port: result.data.port,
        rtcp_port: result.data.rtcp_port,
        rtcp_mux: result.data.rtcp_mux ?? false,
        bitrate: result.data.bitrate ?? 48000,
        audio_ssrc: result.data.audio_ssrc,
        audio_pt: result.data.audio_pt,
      }
      const player = new PipelinePlayer(guildId, streamInfo, this.ctx.logger)
      this.players.set(guildId, player)
      return player
    } catch (err) {
      this.ctx.logger.error('创建播放器失败:', err)
      return null
    }
  }

  async destroyPlayer(guildId: string, channelId: string): Promise<void> {
    const player = this.players.get(guildId)
    if (player) {
      await player.stop()
      this.players.delete(guildId)
    }
    try {
      await this.ctx.kookApi.leaveVoiceChannel(channelId)
    } catch {
      // ignore
    }
  }

  async destroyAll(): Promise<void> {
    for (const [guildId, player] of this.players) {
      await player.stop()
    }
    this.players.clear()
  }
}

export class PipelinePlayer {
  private streamInfo: StreamInfo
  private volume: number
  private ffmpegProcess: ChildProcess | null = null
  status = PlayStatus.STOP
  private isRunning = false
  private playStartTime = 0
  private _onSongEnd: (() => void) | null = null
  private _onError: ((msg: string) => void) | null = null
  songsPlayed = 0

  constructor(
    private guildId: string,
    streamInfo: StreamInfo,
    private logger: { info: (...args: any[]) => void; error: (...args: any[]) => void },
    volume = 0.8,
  ) {
    this.streamInfo = streamInfo
    this.volume = volume
    this.isRunning = true
    this.status = PlayStatus.WAIT
  }

  setCallbacks(onSongEnd?: () => void, onError?: (msg: string) => void) {
    if (onSongEnd) this._onSongEnd = onSongEnd
    if (onError) this._onError = onError
  }

  updateStreamInfo(info: StreamInfo) { this.streamInfo = info }

  async playSong(url: string, name?: string, _dur?: number, startPos?: number): Promise<boolean> {
    this._killProcess()
    const { ip, port, rtcp_port, rtcp_mux, bitrate, audio_ssrc, audio_pt } = this.streamInfo
    if (!ip || !port) { this.logger.error(`[Player][${this.guildId}] 推流信息不完整`); return false }

    const rtpUrl = rtcp_mux
      ? `rtp://${ip}:${port}`
      : `rtp://${ip}:${port}?rtcpport=${rtcp_port}`
    let bitrateK = bitrate > 1000 ? Math.floor(bitrate / 1000) : bitrate
    bitrateK = Math.max(24, Math.min(128, bitrateK))

    const args: string[] = ['-loglevel', 'warning',
      '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5']
    if (startPos && startPos > 0) args.push('-ss', String(startPos))
    args.push('-re', '-i', url, '-map', '0:a:0',
      '-acodec', 'libopus', '-ab', `${bitrateK}k`, '-ac', '2', '-ar', '48000',
      '-filter:a', `volume=${this.volume}`,
      '-f', 'tee', `[select=a:f=rtp:ssrc=${audio_ssrc}:payload_type=${audio_pt}]${rtpUrl}`)

    this.logger.info(`[Player][${this.guildId}] 开始播放: ${name || url.slice(0, 50)}`)
    this.ffmpegProcess = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    this.playStartTime = Date.now()
    this.status = PlayStatus.PLAYING

    this.ffmpegProcess.stderr?.on('data', (d: Buffer) => {
      const msg = d.toString().trim()
      if (msg) this.logger.info(`[Player][${this.guildId}][ffmpeg] ${msg}`)
    })
    this.ffmpegProcess.on('close', (code) => {
      const dur = ((Date.now() - this.playStartTime) / 1000).toFixed(1)
      this.logger.info(`[Player][${this.guildId}] FFmpeg 退出 code=${code} ${dur}s`)
      this.ffmpegProcess = null
      if (this.status === PlayStatus.PLAYING) {
        this.songsPlayed++
        this.status = PlayStatus.END
        this._onSongEnd?.()
      }
    })
    return true
  }

  async skip(): Promise<void> {
    this.logger.info(`[Player][${this.guildId}] 跳过`)
    this.status = PlayStatus.SKIP
    this._killProcess()
    this.status = PlayStatus.END
    this._onSongEnd?.()
  }

  async stop(): Promise<void> {
    this.isRunning = false
    this.status = PlayStatus.STOP
    this._killProcess()
    this.logger.info(`[Player][${this.guildId}] 已停止，共 ${this.songsPlayed} 首`)
  }

  updateVolume(v: number) { this.volume = Math.max(0, Math.min(2, v)) }
  isPlaying(): boolean { return this.status === PlayStatus.PLAYING }
  getCurrentPosition(): number {
    return this.status === PlayStatus.PLAYING ? (Date.now() - this.playStartTime) / 1000 : 0
  }

  private _killProcess() {
    if (this.ffmpegProcess) {
      try { this.ffmpegProcess.kill('SIGKILL') } catch {}
      this.ffmpegProcess = null
    }
  }
}
