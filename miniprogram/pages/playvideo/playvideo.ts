// pages/playvideo/playvideo.ts 竖屏视频回放（与 shared 页实现一致）
import { resolveCloudFile } from '../../utils/cloudMedia'

Component({
  data: {
    song: '',
    score: 0,
    date: '',
    timeText: '',
    rate: 0.8,
    teachFileID: '',
    videoFileID: '',
    // 播放态
    playing: false,
    teachUrl: '',
    userUrl: '',
  },
  methods: {
    onLoad(options: any) {
      const song = options.song ? decodeURIComponent(options.song) : ''
      const score = options.score ? Number(options.score) : 0
      const date = options.date ? decodeURIComponent(options.date) : ''
      const hour = options.hour ? Number(options.hour) : 0
      const minute = options.minute ? Number(options.minute) : 0
      const rate = options.rate ? Number(options.rate) : 0.8
      const teachFileID = options.teach ? decodeURIComponent(options.teach) : ''
      const videoFileID = options.video ? decodeURIComponent(options.video) : ''
      const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
      const timeText = hour || minute ? `${pad(hour)}:${pad(minute)}` : ''

      this.setData({ song, score, date, timeText, rate, teachFileID, videoFileID })

      // 直接进入播放
      this.onPlay()
    },

    // 播放视频：解析 fileID 弹出双视频对比
    async onPlay() {
      wx.showLoading({ title: '加载中...' })
      try {
        const [userUrl, teachUrl] = await Promise.all([
          this.data.videoFileID ? resolveCloudFile(this.data.videoFileID) : Promise.resolve(''),
          this.data.teachFileID ? resolveCloudFile(this.data.teachFileID) : Promise.resolve(''),
        ])
        this.setData({ playing: true, userUrl, teachUrl })
      } catch (e) {
        console.error('[playvideo] 解析视频失败', e)
        wx.showToast({ title: '视频加载失败', icon: 'none' })
      } finally {
        wx.hideLoading()
      }
    },

    // 教练视频播放时设倍速
    onTeachPlay() {
      const rate = this.data.rate
      if (rate && rate !== 1) {
        const ctx = wx.createVideoContext('teachPlayer', this)
        ctx.playbackRate(rate)
      }
    },

    // 关闭播放
    onClosePlay() {
      this.setData({ playing: false, teachUrl: '', userUrl: '' })
    },

    // 分享
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

    // 再跳一次
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

    // 退出
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
