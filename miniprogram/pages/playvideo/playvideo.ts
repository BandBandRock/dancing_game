// pages/playvideo/playvideo.ts 横屏双视频回放：左侧双视频 + 右侧信息面板
import { resolveCloudFile } from '../../utils/cloudMedia'

Component({
  data: {
    teachVideo: '', // 教练视频（解析后的临时 URL）
    userVideo: '',  // 用户录制视频（解析后的临时 URL）
    song: '',
    score: 0,
    date: '',
    timeText: '',
    rate: 0.8, // 教练视频倍速（与跳舞时一致）
    ready: false,
  },
  methods: {
    async onLoad(options: any) {
      const videoRaw = options.video ? decodeURIComponent(options.video) : ''
      const teachRaw = options.teach ? decodeURIComponent(options.teach) : ''
      const song = options.song ? decodeURIComponent(options.song) : ''
      const score = options.score ? Number(options.score) : 0
      const date = options.date ? decodeURIComponent(options.date) : ''
      const hour = options.hour ? Number(options.hour) : 0
      const minute = options.minute ? Number(options.minute) : 0
      const rate = options.rate ? Number(options.rate) : 0.8
      const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
      const timeText = `${pad(hour)}:${pad(minute)}`

      this.setData({ song, score, date, timeText, rate })

      // 并行解析两个 fileID
      try {
        const [userUrl, teachUrl] = await Promise.all([
          videoRaw ? resolveCloudFile(videoRaw) : Promise.resolve(''),
          teachRaw ? resolveCloudFile(teachRaw) : Promise.resolve(''),
        ])
        this.setData({
          userVideo: userUrl,
          teachVideo: teachUrl,
          ready: true,
        })
      } catch (e) {
        console.error('[playvideo] 解析视频失败', e)
        this.setData({ ready: true })
      }
    },

    // 教练视频开始播放时设置倍速
    onTeachPlay() {
      const rate = this.data.rate
      if (rate && rate !== 1) {
        const ctx = wx.createVideoContext('teachPlayer', this)
        ctx.playbackRate(rate)
        console.log('[playvideo] 教练视频倍速设为:', rate)
      }
    },

    onExit() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        wx.navigateBack()
      } else {
        wx.reLaunch({ url: '/pages/history/history' })
      }
    },
  },
})
