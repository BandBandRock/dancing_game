// 跳舞历史记录的本地存储工具
// ============================================================
// 真实场景：用户跳完一支舞、评分结束后，跳舞/评分页（如 pose、dance_search）
// 调用 addHistory({ song, score, date, hour, minute, video }) 写入一条记录。
// 历史页（pages/history/history）调用 getHistory() 读取并展示。
//
// 数据存在小程序本地 Storage（key: danceHistory），不占主包、无需后台。
// 若要跨设备同步，可把 addHistory/getHistory 换成云开发/自建接口。
// ============================================================

export interface DanceRecord {
  id: string
  song: string // 曲名
  score: number // 分数
  date: string // 日期 YYYY-MM-DD
  hour: number // 开始小时 0-23
  minute: number // 开始分钟 0-59
  video: string // 自己跳舞的视频地址（本地路径 或 云地址）
}

const KEY = 'danceHistory'

// 读取全部记录（最新在前）
export function getHistory(): DanceRecord[] {
  return wx.getStorageSync(KEY) || []
}

// 新增一条跳舞记录（最新排在最前）
export function addHistory(rec: Omit<DanceRecord, 'id'>): void {
  const list = getHistory()
  const item: DanceRecord = {
    ...rec,
    id: 'r' + Date.now() + '_' + Math.floor(Math.random() * 1000),
  }
  list.unshift(item)
  wx.setStorageSync(KEY, list)
}

// 删除单条记录（按 id）
export function deleteHistory(id: string): void {
  const list = getHistory().filter((r) => r.id !== id)
  wx.setStorageSync(KEY, list)
}

// 清空全部记录
export function clearHistory(): void {
  wx.removeStorageSync(KEY)
}

// 覆盖写入全部记录（用于清理旧样例时回存）
export function setHistory(list: DanceRecord[]): void {
  wx.setStorageSync(KEY, list)
}
