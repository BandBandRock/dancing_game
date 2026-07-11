// videoRepo.ts —— 舞蹈视频 meta 的云数据库访问层
// ============================================================
// 所有公共教程视频 / 用户上传视频的 meta 统一存放在云开发数据库集合 `videos`，
// 视频文件本体存放在云存储（fileID = cloud://...）。
// 页面不再 hardcode 任何视频数据，一律通过本模块从云端拉取。
//
// 集合 `videos` 字段约定：
//   - name       string  展示名称（歌名 / 用户输入名）
//   - artist     string  作者/来源，可选（无则显示占位）
//   - type       string  舞种：广场舞 / 交谊舞 / 民族舞 / 健身操 / 鬼步舞
//   - duration   string  时长文本，如 "03:32"，可选
//   - fileID     string  云存储文件 ID（cloud://...）
//   - createTime number  创建时间戳（用于排序）
//
// 权限（在云开发控制台对该集合设置）：
//   建议「所有用户可读，仅创建者可写」，这样公共视频所有人可见。
// ============================================================

export interface VideoMeta {
  _id?: string
  name: string
  artist: string
  type: string
  duration: string
  video: string // = fileID（cloud://...），字段名沿用页面里的 video 方便直接播放
  createTime?: number
}

const COLLECTION = 'videos'

// 原始记录 → 统一的 VideoMeta（video 字段取 fileID）
function normalize(doc: any): VideoMeta {
  return {
    _id: doc._id,
    name: doc.name || '未命名',
    artist: doc.artist || '',
    type: doc.type || '未分类',
    duration: doc.duration || '',
    video: doc.fileID || doc.video || '',
    createTime: doc.createTime,
  }
}

// 拉取视频列表；传入 type 时只取该舞种，否则取全部
// 云数据库单次 get 上限 20 条，这里做分页拉全。
export async function fetchVideos(type?: string): Promise<VideoMeta[]> {
  if (!wx.cloud) {
    console.error('[videoRepo] 云开发未初始化')
    return []
  }
  const db = wx.cloud.database()
  const _ = db.command
  let query: any = db.collection(COLLECTION)
  if (type && type !== '全部') {
    query = query.where({ type })
  }

  const MAX = 20
  const all: any[] = []
  try {
    // 先取总数，再分页
    const countRes: any = await query.count()
    const total = countRes.total || 0
    const times = Math.ceil(total / MAX)
    for (let i = 0; i < times; i++) {
      const res: any = await query
        .orderBy('createTime', 'desc')
        .skip(i * MAX)
        .limit(MAX)
        .get()
      all.push(...(res.data || []))
    }
    void _
    return all.map(normalize)
  } catch (e) {
    console.error('[videoRepo] fetchVideos 失败', e)
    return []
  }
}

// 关键词搜索（客户端过滤：先拉全量再按 name/artist/type 匹配）
export async function searchVideos(keyword: string): Promise<VideoMeta[]> {
  const kw = (keyword || '').trim().toLowerCase()
  if (!kw) return []
  const list = await fetchVideos()
  return list.filter(
    (s) =>
      s.name.toLowerCase().includes(kw) ||
      s.artist.toLowerCase().includes(kw) ||
      s.type.toLowerCase().includes(kw),
  )
}

// 新增一条视频 meta（上传成功后调用）
export async function addVideo(record: {
  name: string
  type: string
  fileID: string
  artist?: string
  duration?: string
}): Promise<string | null> {
  if (!wx.cloud) {
    console.error('[videoRepo] 云开发未初始化')
    return null
  }
  const db = wx.cloud.database()
  try {
    const res: any = await db.collection(COLLECTION).add({
      data: {
        name: record.name,
        type: record.type,
        fileID: record.fileID,
        artist: record.artist || '用户上传',
        duration: record.duration || '',
        createTime: Date.now(),
      },
    })
    return res._id || null
  } catch (e) {
    console.error('[videoRepo] addVideo 失败', e)
    return null
  }
}
