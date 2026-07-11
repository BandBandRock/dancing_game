// pages/shared/shared.ts 分享落地页
// 别人通过分享链接点进来：展示舞蹈简介 → 播放对比视频 → 我也要跳
import { resolveCloudFile } from '../../utils/cloudMedia'

Component({
  data: {
    song: '',
    score: 0,
    teach: '',   // 教练视频 fileID
    video: '',   // 用户录制视频 fileID
    rate: 0.8,
    date: '',
    timeText: '',
    // 播放态
    playing: false,
    teachUrl: '',
    userUrl: '',
  },
  methods: {
    onLoad(options: any) {
      const song = options.song ? decodeURIComponent(options.song) : ''
      const score = options.score ? Number(options.score) : 0
      const teach = options.teach ? decodeURIComponent(options.teach) : ''
      const video = options.video ? decodeURIComponent(options.video) : ''
      const rate = options.rate ? Number(options.rate) : 0.8
      const date = options.date ? decodeURIComponent(options.date) : ''
      const hour = options.hour ? Number(options.hour) : 0
      const minute = options.minute ? Number(options.minute) : 0
      const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
      const timeText = hour || minute ? `${pad(hour)}:${pad(minute)}` : ''

      this.setData({ song, score, teach, video, rate, date, timeText })
    },

    // 点击「播放视频」：解析 fileID 并展示双视频对比
    async onPlay() {
      wx.showLoading({ title: '加载中...' })
      try {
        const [teachUrl, userUrl] = await Promise.all([
          this.data.teach ? resolveCloudFile(this.data.teach) : Promise.resolve(''),
          this.data.video ? resolveCloudFile(this.data.video) : Promise.resolve(''),
        ])
        this.setData({ playing: true, teachUrl, userUrl })
      } catch (e) {
        console.error('[shared] 解析视频失败', e)
        wx.showToast({ title: '视频加载失败', icon: 'none' })
      } finally {
        wx.hideLoading()
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

    // 关闭播放
    onClosePlay() {
      this.setData({ playing: false, teachUrl: '', userUrl: '' })
    },

    // 「一起跳这支舞」：跳到搜索页，搜索词为歌名
    onMeToo() {
      wx.navigateTo({
        url: `/pages/search/search?keyword=${encodeURIComponent(this.data.song)}`,
      })
    },

    // 去首页
    onGoHome() {
      wx.reLaunch({ url: '/pages/home/home' })
    },
  },
})
