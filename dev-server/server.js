// 本地视频开发服务器（仅开发预览用）
// 作用：把示例视频以 HTTP 形式提供，让小程序在开发阶段无需把视频打进主包也能播放。
// 正式上线时不需要本服务：把 index.ts 里的 VIDEO_BASE 换成你的云存储/CDN 地址即可。
//
// 启动：  node dev-server/server.js
// 默认地址：http://127.0.0.1:8081/video/xxx.mp4
// 注意：微信开发者工具需勾选「不校验合法域名…」才能加载 127.0.0.1 的视频。

const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, 'public')
const PORT = process.env.PORT || 8081

const MIME = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mov': 'video/quicktime',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
}

// 统一处理普通 / Range 请求的视频流式输出
function streamFile(res, filePath, total, range, type) {
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range)
    const start = m && m[1] ? parseInt(m[1], 10) : 0
    let end = m && m[2] ? parseInt(m[2], 10) : total - 1
    if (start > end || start >= total) {
      res.writeHead(416, { 'Content-Range': `bytes */${total}` })
      res.end()
      return
    }
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': type,
    })
    fs.createReadStream(filePath, { start, end }).pipe(res)
  } else {
    res.writeHead(200, {
      'Content-Length': total,
      'Accept-Ranges': 'bytes',
      'Content-Type': type,
    })
    fs.createReadStream(filePath).pipe(res)
  }
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  if (urlPath === '/') urlPath = '/index.html'

  const filePath = path.normalize(path.join(ROOT, urlPath))
  // 防目录穿越
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // 兜底：请求的真实视频（如 gcd-01.mp4）尚未上传到云服务器时，
      // 按舞种前缀回退到该舞种的「示例占位视频」，避免预览黑屏；
      // 不同舞种对应不同片段，便于区分、不再"每首都一样"。
      const base = path.basename(urlPath) // gcd-01.mp4
      const prefix = base.split('-')[0] // gcd
      const map = {
        gcd: 'bbb.mp4', // 广场舞
        jyx: 'flower.mp4', // 交谊舞
        mz: 'sintel.mp4', // 民族舞
        js: 'jellyfish.mp4', // 健身操
        gb: 'bbb.mp4', // 鬼步舞
      }
      const fallbackName = map[prefix] || 'bbb.mp4'
      const fallback = path.join(ROOT, 'video', fallbackName)
      fs.stat(fallback, (ferr, fstat) => {
        if (ferr || !fstat.isFile()) {
          res.writeHead(404)
          res.end('Not found: ' + urlPath)
          return
        }
        streamFile(res, fallback, fstat.size, req.headers.range, 'video/mp4')
      })
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    const type = MIME[ext] || 'application/octet-stream'
    streamFile(res, filePath, stat.size, req.headers.range, type)
  })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[dev-video] 视频服务已启动: http://127.0.0.1:${PORT}/video/`)
})
