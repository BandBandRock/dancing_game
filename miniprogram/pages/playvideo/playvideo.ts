// pages/playvideo/playvideo.ts 横屏双视频回放：左侧双视频 + 右侧信息面板
import { resolveCloudFile } from '../../utils/cloudMedia'

Component({
  data: {
    teachVideo: '', // 教练视频（解析后的临时 URL）
    userVideo: '',  // 用户录制视频（解析后的临时 URL）
    teachFileID: '', // 教练视频原始 fileID（分享/再跳用）
    videoFileID: '', // 用户视频原始 fileID
    song: '',
    score: 0,
    date: '',
    timeText: '',
    rate: 0.8,
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

      this.setData({ song, score, date, timeText, rate, teachFileID: teachRaw, videoFileID: videoRaw })

      // 并行解析两个 fileID
      try {
        const [userUrl, teachUrl] = await Promise.all([
          videoRaw ? resolveCloudFile(videoRaw) : Promise.resolve(''),
          teachRaw ? resolveCloudFile(teachRaw) : Promise.resolve(''),
        ])
        this.setData({ userVideo: userUrl, teachVideo: teachUrl, ready: true })
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
      }
    },

    // 分享视频
    onShareAppMessage() {
      return {
        title: `我跳了《${this.data.song}》，平均分 ${this.data.score}！快来一起跳～`,
        path:
          `pages/shared/shared?song=${encodeURIComponent(this.data.song)}` +
          `&score=${this.data.score}` +
          `&teach=${encodeURIComponent(this.data.teachFileID)}` +
          `&video=${encodeURIComponent(this.data.videoFileID)}` +
          `&rate=${this.data.rate}` +
          `&date=${encodeURIComponent(this.data.date)}`,
      }
    },

    onShare() {
      // 无需额外逻辑，由 button open-type="share" 触发 onShareAppMessage
    },

    // 再跳一次：带教练视频跳到 pose 页
    onRedance() {
      if (!this.data.teachFileID) {
        wx.showToast({ title: '无教练视频', icon: 'none' })
        return
      }
      wx.navigateTo({
        url:
          `/pages/pose/pose?video=${encodeURIComponent(this.data.teachFileID)}` +
          `&song=${encodeURIComponent(this.data.song)}` +
          `&rate=${this.data.rate}`,
      })
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
