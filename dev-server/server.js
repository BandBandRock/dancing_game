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

// —— 上传目录 ——
const UPLOADS_DIR = path.join(ROOT, 'upload')
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

// 上传记录（内存 + JSON 持久化）
const MANIFEST_PATH = path.join(__dirname, 'upload-manifest.json')
let uploadManifest = []
try {
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8')
  uploadManifest = JSON.parse(raw)
} catch (e) {
  uploadManifest = []
}

function saveManifest() {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(uploadManifest, null, 2), 'utf8')
}

// 统一流式响应视频
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
  // —— CORS（允许小程序开发工具跨域）——
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // —— POST /upload —— 接收视频上传
  if (req.method === 'POST' && req.url === '/upload') {
    const contentType = req.headers['content-type'] || ''
    if (!contentType.includes('multipart/form-data')) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ code: 1, msg: '需 multipart/form-data 格式' }))
      return
    }

    const boundary = '--' + contentType.split('boundary=')[1]
    const bufs = []
    req.on('data', (chunk) => bufs.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(bufs)

      // 简易 multipart 解析
      const parts = splitMultipart(raw, boundary)
      let fileName = ''
      let fileData = null
      let danceType = ''

      for (const part of parts) {
        const headerEnd = part.indexOf('\r\n\r\n')
        if (headerEnd === -1) continue
        const header = part.slice(0, headerEnd).toString('utf8')
        const body = part.slice(headerEnd + 4)

        if (header.includes('name="type"')) {
          danceType = body.toString('utf8').replace(/\r?\n/g, '').trim()
        } else if (header.includes('name="video"') && header.includes('filename')) {
          const fnMatch = header.match(/filename="([^"]*)"/)
          const ext = fnMatch ? path.extname(fnMatch[1]) : '.mp4'
          // 去除末尾的 \r\n
          fileData = body.slice(0, body.length - 2)
          const ts = Date.now()
          fileName = `upload_${ts}${ext}`
        }
      }

      if (!fileData) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ code: 1, msg: '未收到视频文件' }))
        return
      }

      const savePath = path.join(UPLOADS_DIR, fileName)
      fs.writeFileSync(savePath, fileData)

      const record = {
        id: uploadManifest.length + 1,
        name: fileName,
        type: danceType || '未分类',
        url: `/upload/${fileName}`,
        createTime: new Date().toISOString(),
      }
      uploadManifest.push(record)
      saveManifest()

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ code: 0, msg: '上传成功', data: record }))
    })
    return
  }

  // —— GET /upload-manifest —— 获取上传列表
  if (req.method === 'GET' && req.url === '/upload-manifest') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ code: 0, data: uploadManifest }))
    return
  }

  // —— 静态文件 ——
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0])
  if (urlPath === '/') urlPath = '/index.html'

  const filePath = path.normalize(path.join(ROOT, urlPath))
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // 兜底回退
      const base = path.basename(urlPath)
      const prefix = base.split('-')[0]
      const map = {
        gcd: 'bbb.mp4',
        jyx: 'flower.mp4',
        mz: 'sintel.mp4',
        js: 'jellyfish.mp4',
        gb: 'bbb.mp4',
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
  console.log(`[dev-video] 视频服务已启动: http://127.0.0.1:${PORT}/`)
  console.log(`[dev-video] 上传地址: POST http://127.0.0.1:${PORT}/upload`)
})

// —— 简易 multipart 解析 ——
function splitMultipart(buf, boundary) {
  const b = Buffer.from(boundary)
  const parts = []
  let start = 0
  while (true) {
    const idx = buf.indexOf(b, start)
    if (idx === -1) break
    const partStart = idx + b.length
    // 跳过开头的 \r\n
    const contentStart = buf[partStart] === 13 ? partStart + 2 : partStart
    const nextIdx = buf.indexOf(b, contentStart)
    if (nextIdx === -1) {
      // 最后一部分（末尾有 --）
      const endMarker = Buffer.from('--')
      const endIdx = buf.indexOf(endMarker, contentStart)
      if (endIdx > contentStart) {
        parts.push(buf.slice(contentStart, endIdx > contentStart ? endIdx - 2 : buf.length))
      }
      break
    }
    // 去掉末尾的 \r\n
    let end = nextIdx
    while (end > contentStart && (buf[end - 1] === 13 || buf[end - 1] === 10)) end--
    parts.push(buf.slice(contentStart, end))
    start = nextIdx
  }
  return parts
}
