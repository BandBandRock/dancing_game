// 上传视频页（基于云开发存储，无需 SecretKey）
import { uploadVideo } from '../../utils/cosUpload'

Component({
  data: {
    tempFilePath: '',   // 本地选中的视频临时路径
    duration: 0,        // 视频时长(秒)
    size: 0,            // 视频大小(字节)
    uploading: false,   // 是否上传中
    percent: 0,         // 上传进度 0~100
    resultUrl: '',      // 上传成功后的临时播放地址
    resultFileID: '',   // 上传成功后的云存储 fileID
  },

  methods: {
    // 选择视频
    chooseVideo() {
      wx.chooseMedia({
        count: 1,
        mediaType: ['video'],
        sourceType: ['album', 'camera'],
        maxDuration: 60,
        camera: 'back',
        success: (res) => {
          const file = res.tempFiles[0]
          this.setData({
            tempFilePath: file.tempFilePath,
            duration: file.duration || 0,
            size: file.size || 0,
            resultUrl: '',
            resultFileID: '',
            percent: 0,
          })
        },
        fail: (err) => {
          console.log('选择取消或失败', err)
        },
      })
    },

    // 开始上传
    async startUpload() {
      const { tempFilePath, uploading } = this.data
      if (!tempFilePath) {
        wx.showToast({ title: '请先选择视频', icon: 'none' })
        return
      }
      if (uploading) return

      this.setData({ uploading: true, percent: 0 })
      wx.showLoading({ title: '上传中 0%', mask: true })

      try {
        const result = await uploadVideo({
          filePath: tempFilePath,
          onProgress: (p) => {
            const percent = Math.round(p * 100)
            this.setData({ percent })
            wx.showLoading({ title: `上传中 ${percent}%`, mask: true })
          },
        })
        wx.hideLoading()
        this.setData({
          uploading: false,
          resultUrl: result.url,
          resultFileID: result.fileID,
        })
        wx.showToast({ title: '上传成功', icon: 'success' })
        console.log('云存储上传结果:', result)
      } catch (err) {
        wx.hideLoading()
        this.setData({ uploading: false })
        console.error('上传失败', err)
        wx.showToast({ title: '上传失败', icon: 'none' })
      }
    },

    // 复制临时播放地址
    copyUrl() {
      if (!this.data.resultUrl) return
      wx.setClipboardData({ data: this.data.resultUrl })
    },

    // 复制云存储 fileID
    copyFileID() {
      if (!this.data.resultFileID) return
      wx.setClipboardData({ data: this.data.resultFileID })
    },
  },
})
