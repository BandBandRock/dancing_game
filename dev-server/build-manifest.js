// 从 index.ts 抽取歌曲清单，生成 video-manifest.json
// 用途：你把自己的真实舞曲视频按 manifest 里的 file 命名传到云服务器（COS/OSS/…），
//       再把 index.ts 的 VIDEO_BASE 改成云地址，即可精准匹配、不占小程序包体积。
const fs = require('fs')
const path = require('path')

const tsPath = path.join(__dirname, '..', 'miniprogram', 'pages', 'dance_search', 'dance_search.ts')
const src = fs.readFileSync(tsPath, 'utf8')

const block = src.match(/songs:\s*\[([\s\S]*?)\]\s*as Song\[\]/)
if (!block) {
  console.error('未找到 songs 数组')
  process.exit(1)
}
const rows = [...block[1].matchAll(
  /\{\s*name:\s*'([^']+)',\s*artist:\s*'([^']+)',\s*type:\s*'([^']+)',\s*duration:\s*'([^']+)',\s*video:\s*'([^']+)'\s*\}/g
)]

const list = rows.map((r, i) => ({
  id: i + 1,
  name: r[1],
  artist: r[2],
  type: r[3],
  duration: r[4],
  file: r[5],
}))

const out = path.join(__dirname, 'video-manifest.json')
fs.writeFileSync(out, JSON.stringify(list, null, 2), 'utf8')
console.log('已生成 ' + list.length + ' 条记录 -> ' + out)
