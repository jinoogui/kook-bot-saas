import type { CommandDefinition, KookMessageEvent, PluginContext } from '@kook-saas/shared'
import { AudioPlayerService, PlayStatus } from './service.js'

export function getCommands(): CommandDefinition[] {
  return [
    {
      name: 'play',
      aliases: ['播放', 'p'],
      description: '播放音频 URL',
      handler: async (event: KookMessageEvent, args: string[], ctx: PluginContext): Promise<void> => {
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        if (!guildId) return

        const url = args[0]
        if (!url) {
          await ctx.kookApi.sendKmarkdownMessage(channelId, '请提供音频 URL\n用法: /play <url>')
          return
        }

        const service = new AudioPlayerService(ctx)
        let player = service.getPlayer(guildId)
        if (!player) {
          // Try to join voice channel (use channelId as voice channel for now)
          const created = await service.createPlayer(guildId, channelId)
          if (!created) {
            await ctx.kookApi.sendKmarkdownMessage(channelId, '无法加入语音频道')
            return
          }
          player = created
        }

        const name = args.slice(1).join(' ') || undefined
        const success = await player.playSong(url, name)
        if (success) {
          await ctx.kookApi.sendKmarkdownMessage(channelId, `开始播放: **${name || url.slice(0, 50)}**`)
        } else {
          await ctx.kookApi.sendKmarkdownMessage(channelId, '播放失败')
        }
      },
    },
    {
      name: 'stop',
      aliases: ['停止播放'],
      description: '停止播放',
      handler: async (event: KookMessageEvent, _args: string[], ctx: PluginContext): Promise<void> => {
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        if (!guildId) return

        const service = new AudioPlayerService(ctx)
        await service.destroyPlayer(guildId, channelId)
        await ctx.kookApi.sendKmarkdownMessage(channelId, '已停止播放')
      },
    },
    {
      name: 'skip',
      aliases: ['跳过', 'next'],
      description: '跳过当前歌曲',
      handler: async (event: KookMessageEvent, _args: string[], ctx: PluginContext): Promise<void> => {
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        if (!guildId) return

        const service = new AudioPlayerService(ctx)
        const player = service.getPlayer(guildId)
        if (!player || !player.isPlaying()) {
          await ctx.kookApi.sendKmarkdownMessage(channelId, '当前没有播放中的歌曲')
          return
        }
        await player.skip()
        await ctx.kookApi.sendKmarkdownMessage(channelId, '已跳过')
      },
    },
    {
      name: 'volume',
      aliases: ['音量', 'vol'],
      description: '调节音量 (0-200)',
      handler: async (event: KookMessageEvent, args: string[], ctx: PluginContext): Promise<void> => {
        const channelId = event.target_id
        const guildId = event.extra?.guild_id
        if (!guildId) return

        const service = new AudioPlayerService(ctx)
        const player = service.getPlayer(guildId)
        if (!player) {
          await ctx.kookApi.sendKmarkdownMessage(channelId, '当前没有活跃的播放器')
          return
        }

        const vol = parseInt(args[0])
        if (isNaN(vol) || vol < 0 || vol > 200) {
          await ctx.kookApi.sendKmarkdownMessage(channelId, '音量范围: 0-200')
          return
        }

        player.updateVolume(vol / 100)
        await ctx.kookApi.sendKmarkdownMessage(channelId, `音量已设置为 ${vol}%`)
      },
    },
  ]
}
