// pages/playvideo/playvideo.ts 全屏播放自己跳舞的视频
import { resolveCloudFile } from '../../utils/cloudMedia'

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
        // 统一策略：cloud:// fileID 解析成临时 https 再播放，普通 URL 原样
        resolveCloudFile(raw).then((url) => {
          this.setData({ video: url, song })
        }).catch((e) => {
          console.error('[playvideo] 解析云端地址失败', e)
          this.setData({ video: '', song })
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
