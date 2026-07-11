// 视频上传封装（基于微信云开发存储，无需任何 SecretKey）
//
// 原理：小程序端直接调用 wx.cloud.uploadFile 把文件传到云开发存储，
// 返回的 fileID 形如 cloud://环境/uploads/xxx.mp4。fileID 不能直接给 <video>，
// 需要再用 wx.cloud.getTempFileURL 解析成临时 https 地址才能播放。
// 依赖：app.ts 中已 wx.cloud.init 初始化云环境，无需额外 SDK / 密钥。

export interface UploadResult {
  // 云存储 fileID，形如 cloud://xxx/uploads/1699999999_abc.mp4
  fileID: string
  // 临时可播放地址（已通过 getTempFileURL 解析，有效期约 2 小时）
  url: string
}

export interface UploadOptions {
  // 本地文件路径，来自 wx.chooseMedia 的 tempFilePath 或录制返回的临时路径
  filePath: string
  // 可选：自定义文件名，不传则用时间戳+随机数
  fileName?: string
  // 上传进度回调，percent 为 0~1
  onProgress?: (percent: number) => void
  // 超时兜底（毫秒），默认 180000（3 分钟）；大视频可调大
  timeoutMs?: number
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
// 带 60s 总超时兜底，避免「上传中」永久假死无提示
export function uploadVideo(options: UploadOptions): Promise<UploadResult> {
  const { filePath, fileName, onProgress, timeoutMs } = options
  const cloudPath = buildCloudPath(filePath, fileName)
  const TIMEOUT = timeoutMs || 180000
  console.log('[uploadVideo] 开始上传 ->', { cloudPath, filePath, TIMEOUT })

  return new Promise((resolve, reject) => {
    // 总超时兜底：TIMEOUT 内 uploadFile 既无 success 也无 fail，则判定卡死
    const timer = setTimeout(() => {
      reject(new Error(`上传超时（${TIMEOUT / 1000}s 无回调）。可能原因：视频过大/模拟器网络慢，或云环境未开通云存储。建议用真机调试，或换小视频重试。`))
    }, TIMEOUT)

    wx.cloud.uploadFile({
      cloudPath,
      filePath,
      onUploadProgress: (e: any) => {
        const p = typeof e.progress === 'number' ? e.progress : 0
        console.log('[uploadVideo] 上传进度', p)
        if (onProgress) onProgress(p / 100)
      },
      success: (res: any) => {
        console.log('[uploadVideo] uploadFile 成功, fileID =', res.fileID)
        // 上传成功后解析临时播放地址
        wx.cloud.getTempFileURL({
          fileList: [res.fileID],
          success: (urlRes: any) => {
            clearTimeout(timer)
            const item = urlRes.fileList && urlRes.fileList[0]
            const url = (item && item.tempFileURL) || ''
            if (!url) {
              console.warn('[uploadVideo] 拿到 fileID 但解析临时地址为空，errMsg =', item && item.errMsg)
            }
            resolve({ fileID: res.fileID, url })
          },
          fail: (e: any) => {
            // 即使拿不到临时地址，也至少返回 fileID 供后续解析
            clearTimeout(timer)
            console.warn('[uploadVideo] 获取临时地址失败，仅返回 fileID', e)
            resolve({ fileID: res.fileID, url: '' })
          },
        })
      },
      fail: (e: any) => {
        clearTimeout(timer)
        console.error('[uploadVideo] uploadFile 失败', e)
        reject(e)
      },
    })
  })
}
