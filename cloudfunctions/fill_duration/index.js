// 云函数：fill_duration
// 功能：把 videos 集合中缺少 duration 的记录标记出来，返回需要填充的列表。
// 实际时长获取由小程序端完成（video 组件 loadedmetadata 最可靠）。
// 也可手动传入 { updates: [{id, duration}] } 来批量更新。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const COLLECTION = 'videos'

exports.main = async (event) => {
  // 模式1：批量更新 duration（小程序端获取到时长后调用）
  if (event && event.updates && Array.isArray(event.updates)) {
    let updated = 0
    for (const item of event.updates) {
      if (item.id && item.duration) {
        try {
          await db.collection(COLLECTION).doc(item.id).update({
            data: { duration: item.duration }
          })
          updated++
        } catch (e) {
          console.error('update failed:', item.id, e)
        }
      }
    }
    return { updated, total: event.updates.length }
  }

  // 模式2：返回所有缺少 duration 的记录（供小程序端逐个获取时长）
  const MAX = 100
  const countRes = await db.collection(COLLECTION).count()
  const total = countRes.total || 0
  const all = []
  const times = Math.ceil(total / MAX)
  for (let i = 0; i < times; i++) {
    const res = await db.collection(COLLECTION).skip(i * MAX).limit(MAX).get()
    all.push(...(res.data || []))
  }

  // duration 为空串、undefined、null、"00:00" 都算缺失
  const needFill = all.filter((r) => !r.duration || r.duration === '00:00' || r.duration.trim() === '').map((r) => ({
    _id: r._id,
    name: r.name,
    fileID: r.fileID || r.video,
  }))

  return { total, needFill: needFill.length, list: needFill }
}
