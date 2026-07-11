// pages/playvideo/playvideo.ts 全屏播放自己跳舞的视频
Component({
  data: {
    video: '',
    song: '',
  },
  methods: {
    onLoad(options: any) {
      if (options && options.video) {
        this.setData({
          video: decodeURIComponent(options.video),
          song: options.song ? decodeURIComponent(options.song) : '',
        })
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
