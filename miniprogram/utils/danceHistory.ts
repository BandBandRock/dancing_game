// 跳舞历史记录的云开发数据库工具
// ============================================================
// 真机/多设备场景：记录元数据（曲名/分数/时间/视频fileID等）存放到
// 微信云开发的「云数据库」集合 danceHistory，而非本地 Storage。
// 这样记录跨设备可读、不随重装丢失。
//
// 隔离与权限：集合已设为「所有用户可读，仅创建者可读写」。由于可读范围变大，
// 云库不再自动按 _openid 隔离，因此 getHistory 显式 .where({ _openid }) 只取自己
// 的记录（openid 由 user_mgr 云函数获取并缓存）。写入自动注入 _openid，仅本人可改/删。
// 他人访问我的记录后续通过其他手段（如云函数）解决，不在此处处理。
//
// 存储：视频/骨骼已是云端 fileID（cloud://），直接作为字段存即可；
// 播放时由 playvideo / skelview 页用 wx.cloud.getTempFileURL 解析。
// ============================================================

const COLLECTION = 'danceHistory'

export interface DanceRecord {
  _id?: string // 云文档主键（删除时用到）
  id: string // 业务主键（前端沿用，便于选择/调试）
  song: string // 曲名
  score: number // 分数
  date: string // 日期 YYYY-MM-DD
  hour: number // 开始小时 0-23
  minute: number // 开始分钟 0-59
  video: string // 自己跳舞的视频云端地址（cloud:// fileID）
  skeleton?: string // 用户跳舞骨骼序列云端地址（cloud:// fileID）
  teach?: string // 教学/示例视频云端地址（cloud:// fileID）
  rate?: number // 教学视频倍速（0.5/0.8 等），回放时教练视频同步
  createTime?: number // 写入时间戳（客户端排序用）
}

function getDB(): any {
  return wx.cloud.database()
}

// 获取当前用户 openid（复用 user_mgr 云函数，缓存到本地避免每次调用）。
// 后续「他人访问我的记录」走别的手段，不依赖此处的 openid 过滤。
function getOpenId(): Promise<string> {
  const cached = wx.getStorageSync('__openid')
  if (cached) return Promise.resolve(cached)
  return wx.cloud
    .callFunction({ name: 'user_mgr' })
    .then((res: any) => {
      const openid = res && res.result && res.result.openid
      if (openid) wx.setStorageSync('__openid', openid)
      return openid || ''
    })
    .catch((e: any) => {
      console.error('[danceHistory] 获取 openid 失败', e)
      return ''
    })
}

// 把云文档规整成前端用的 DanceRecord（兼容缺字段的旧数据）
function normalize(doc: any): DanceRecord {
  return {
    _id: doc._id,
    id: doc.id || doc._id,
    song: doc.song || '',
    score: doc.score || 0,
    date: doc.date || '',
    hour: doc.hour || 0,
    minute: doc.minute || 0,
    video: doc.video || '',
    skeleton: doc.skeleton || undefined,
    teach: doc.teach || undefined,
    rate: doc.rate || undefined,
    createTime: doc.createTime || 0,
  }
}

// 读取当前用户自己的记录（按写入时间倒序）。
// 注意：集合权限已设为「所有用户可读，仅创建者可读写」，云库不再自动按
// _openid 隔离；这里显式 .where({ _openid }) 只拉自己的，避免混入他人记录。
// 他人访问我的记录通过其他手段解决，不走这里。
export function getHistory(): Promise<DanceRecord[]> {
  return getOpenId().then((openid) => {
    let q = getDB().collection(COLLECTION)
    if (openid) q = q.where({ _openid: openid })
    return q
      .limit(1000)
      .get()
      .then((res: any) => {
        const list = (res.data || []).map(normalize)
        // 客户端排序，避免云数据库 orderBy 需要建索引的限制
        list.sort((a: DanceRecord, b: DanceRecord) => (b.createTime || 0) - (a.createTime || 0))
        return list
      })
      .catch((e: any) => {
        console.error('[danceHistory] 读取失败', e)
        return [] as DanceRecord[]
      })
  })
}

// 新增一条跳舞记录（自动注入 _openid，跨设备可读、按用户隔离）
export function addHistory(rec: Omit<DanceRecord, 'id' | '_id'>): Promise<void> {
  const item: any = {
    ...rec,
    id: 'r' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    createTime: Date.now(),
  }
  return getDB()
    .collection(COLLECTION)
    .add({ data: item })
    .then(() => {})
    .catch((e: any) => {
      console.error('[danceHistory] 写入失败', e)
      throw e
    })
}

// 删除单条记录（按云文档 _id）
export function deleteHistory(id: string): Promise<void> {
  if (!id) return Promise.resolve()
  return getDB()
    .collection(COLLECTION)
    .doc(id)
    .remove()
    .then(() => {})
    .catch((e: any) => {
      console.error('[danceHistory] 删除失败', e)
    })
}

// 清空全部（仅当前用户）：先查出自己的全部，再逐条删除
export function clearHistory(): Promise<void> {
  return getHistory().then((list: DanceRecord[]) =>
    Promise.all(list.map((r) => deleteHistory(r._id || r.id))).then(() => {})
  )
}
