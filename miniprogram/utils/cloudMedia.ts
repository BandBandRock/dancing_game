// 云文件 fileID → 可访问地址 的统一解析策略
// ============================================================
// 小程序里 cloud:// fileID 不能直接喂给 <video>/<image> 或 wx.request，
// 必须先 wx.cloud.getTempFileURL 解析成临时 https 地址（有效期约 2 小时）。
// 普通 https/http 地址则原样返回。
// 统一走 resolveCloudFile，调用方无需关心传入的是 fileID 还是普通 URL。

// 云存储基础前缀：所有舞蹈示范视频都放在这个云存储目录下。
// 视频文件名（如 gcd-02.mp4）直接对应云存储里的同名对象。
export const CLOUD_BASE = 'cloud://cloud1-d9gm4mnma453a20a7.636c-cloud1-d9gm4mnma453a20a7-1253975745/'

// 判断是否为云文件 fileID
export function isCloudFile(id: string): boolean {
  return typeof id === 'string' && id.startsWith('cloud://')
}

// 把视频文件名 / 已经是 fileID 的地址，统一成 cloud:// fileID。
//   - cloud:// 开头：原样返回
//   - 普通文件名（如 gcd-02.mp4）：拼上 CLOUD_BASE
export function toCloudFileID(video: string): string {
  if (!video) return ''
  return isCloudFile(video) ? video : CLOUD_BASE + video
}

// 把 fileID / 普通 URL 解析成可访问地址
//   - 普通 URL：直接 resolve 原值
//   - cloud:// fileID：getTempFileURL 解析成临时 https
export function resolveCloudFile(fileID: string): Promise<string> {
  if (!fileID) return Promise.resolve('')
  if (!isCloudFile(fileID)) return Promise.resolve(fileID)
  return new Promise((resolve, reject) => {
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: (res: any) => {
        const item = res.fileList && res.fileList[0]
        const url = item && item.tempFileURL
        if (!url) {
          reject(new Error('getTempFileURL 返回空: ' + JSON.stringify(res)))
          return
        }
        resolve(url)
      },
      fail: (e: any) => reject(e),
    })
  })
}

// 批量解析（保持顺序），普通 URL 原样透传
export function resolveCloudFiles(ids: string[]): Promise<string[]> {
  const tasks = (ids || []).map((id) => resolveCloudFile(id))
  return Promise.all(tasks)
}
