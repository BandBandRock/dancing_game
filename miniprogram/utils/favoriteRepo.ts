// favoriteRepo.ts —— 用户收藏的云数据库访问层
// ============================================================
// 集合 `favorites`，每条记录：
//   - _openid  string  自动填入（云开发自动注入当前用户 openid）
//   - videoId  string  videos 集合的 _id（关联视频记录）
//   - name     string  视频名称（冗余，方便展示）
//   - type     string  舞种
//   - fileID   string  cloud:// 文件 ID（冗余，方便直接播放）
//   - createTime number 收藏时间
//
// 权限建议：「仅创建者可读写」
// ============================================================

export interface FavoriteItem {
  _id?: string
  videoId?: string
  name: string
  type: string
  fileID: string
  createTime?: number
}

const COLLECTION = 'favorites'

// 加载当前用户的全部收藏（返回 map: key → _id，key = name|type）
export async function loadFavorites(): Promise<{ keys: Record<string, string>; list: FavoriteItem[] }> {
  if (!wx.cloud) return { keys: {}, list: [] }
  const db = wx.cloud.database()
  try {
    const MAX = 20
    const countRes: any = await db.collection(COLLECTION).count()
    const total = countRes.total || 0
    const times = Math.ceil(total / MAX)
    const all: any[] = []
    for (let i = 0; i < times; i++) {
      const res: any = await db.collection(COLLECTION)
        .orderBy('createTime', 'desc')
        .skip(i * MAX)
        .limit(MAX)
        .get()
      all.push(...(res.data || []))
    }
    const keys: Record<string, string> = {}
    const list: FavoriteItem[] = all.map((doc: any) => {
      const item: FavoriteItem = {
        _id: doc._id,
        videoId: doc.videoId,
        name: doc.name,
        type: doc.type,
        fileID: doc.fileID,
        createTime: doc.createTime,
      }
      keys[`${doc.name}|${doc.type}`] = doc._id
      return item
    })
    return { keys, list }
  } catch (e) {
    console.error('[favoriteRepo] loadFavorites 失败', e)
    return { keys: {}, list: [] }
  }
}

// 添加收藏
export async function addFavorite(song: { name: string; type: string; fileID: string; videoId?: string }): Promise<string | null> {
  if (!wx.cloud) return null
  const db = wx.cloud.database()
  try {
    const res: any = await db.collection(COLLECTION).add({
      data: {
        videoId: song.videoId || '',
        name: song.name,
        type: song.type,
        fileID: song.fileID,
        createTime: Date.now(),
      },
    })
    return res._id || null
  } catch (e) {
    console.error('[favoriteRepo] addFavorite 失败', e)
    return null
  }
}

// 取消收藏（按记录 _id 删除）
export async function removeFavorite(recordId: string): Promise<boolean> {
  if (!wx.cloud || !recordId) return false
  const db = wx.cloud.database()
  try {
    await db.collection(COLLECTION).doc(recordId).remove()
    return true
  } catch (e) {
    console.error('[favoriteRepo] removeFavorite 失败', e)
    return false
  }
}
