// pages/playvideo/playvideo.ts 全屏播放自己跳舞的视频
Component({
  data: {
    video: '',
    song: '',
  },
  methods: {
    onLoad(options: any) {
      if (options && options.video) {
        const raw = decodeURIComponent(options.video)
        const song = options.song ? decodeURIComponent(options.song) : ''
        if (raw.indexOf('cloud://') === 0) {
          // 云端 fileID：需解析成临时 https 地址才能播放
          wx.cloud.getTempFileURL({
            fileList: [raw],
            success: (res: any) => {
              const item = res.fileList && res.fileList[0]
              const url = (item && item.tempFileURL) || ''
              this.setData({ video: url || raw, song })
            },
            fail: () => {
              console.error('[playvideo] 解析云端地址失败', raw)
              this.setData({ video: '', song })
            },
          })
        } else {
          this.setData({ video: raw, song })
        }
      }
    },
    // 左上角「✕」退出键：返回历史页
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
