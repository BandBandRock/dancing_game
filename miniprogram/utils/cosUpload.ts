// 视频上传封装（基于微信云开发存储，无需任何 SecretKey）
//
// 原理：小程序端直接调用 wx.cloud.uploadFile 把文件传到云开发存储，
// 返回的 fileID 形如 cloud://环境/v1.mp4。fileID 不能直接给 <video>，
// 需要再用 wx.cloud.getTempFileURL 解析成临时 https 地址才能播放。
// 依赖：app.ts 中已 wx.cloud.init 初始化云环境，无需额外 SDK / 密钥。

export interface UploadResult {
  // 云存储 fileID，形如 cloud://xxx/uploads/1699999999_abc.mp4
  fileID: string
  // 临时可播放地址（已通过 getTempFileURL 解析，有效期约 2 小时）
  url: string
}

export interface UploadOptions {
  // 本地文件路径，来自 wx.chooseMedia 的 tempFilePath
  filePath: string
  // 可选：自定义文件名，不传则用时间戳+随机数
  fileName?: string
  // 上传进度回调，percent 为 0~1
  onProgress?: (percent: number) => void
}

// 生成云存储路径：uploads/时间戳_随机串.扩展名
function buildCloudPath(filePath: string, fileName?: string): string {
  const prefix = 'uploads/'
  if (fileName) return prefix + fileName
  const extMatch = /\.([a-zA-Z0-9]+)$/.exec(filePath)
  const ext = extMatch ? extMatch[1] : 'mp4'
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}${Date.now()}_${rand}.${ext}`
}

// 上传单个视频到云开发存储，返回 fileID 与临时播放地址
export function uploadVideo(options: UploadOptions): Promise<UploadResult> {
  const { filePath, fileName, onProgress } = options
  const cloudPath = buildCloudPath(filePath, fileName)

  return new Promise((resolve, reject) => {
    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      onUploadProgress: (progressEvent: { progress: number }) => {
        if (onProgress) onProgress(progressEvent.progress / 100)
      },
      success: async (res) => {
        try {
          // 上传成功后解析临时播放地址
          const urlRes: any = await new Promise((r2, j2) => {
            wx.cloud.getTempFileURL({
              fileList: [res.fileID],
              success: r2,
              fail: j2,
            })
          })
          const item = urlRes.fileList && urlRes.fileList[0]
          const url = (item && item.tempFileURL) || ''
          resolve({ fileID: res.fileID, url })
        } catch (e) {
          // 即使拿不到临时地址，也至少返回 fileID 供后续解析
          resolve({ fileID: res.fileID, url: '' })
        }
      },
      fail: reject,
    })
  })
}
