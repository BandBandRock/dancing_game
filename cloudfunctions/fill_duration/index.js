// 云函数：fill_duration（兼做骨骼清洗桥接）
// 功能：
//   1. 无参数调用 → 返回缺 duration 的视频列表
//   2. { updates: [{id, duration}] } → 批量更新 duration
//   3. { action: "listNoSkeleton" } → 返回缺 skeletonFileID 的视频列表（含临时URL）
//   4. { action: "updateSkeleton", id, skeletonFileID } → 写回骨骼 fileID
//   5. { action: "uploadSkeleton", id, name, content } → 上传骨骼JSON到云存储并写回
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const COLLECTION = 'videos'

exports.main = async (event) => {
  // === 骨骼相关 ===

  // 3. 返回缺骨骼的视频列表（含临时下载URL）
  if (event && event.action === 'listNoSkeleton') {
    const all = await fetchAll()
    const need = all.filter((r) => !r.skeletonFileID)
    // 批量获取临时URL
    const fileIDs = need.map((r) => r.fileID || r.video).filter(Boolean)
    let urlMap = {}
    if (fileIDs.length > 0) {
      // getTempFileURL 一次最多50个
      for (let i = 0; i < fileIDs.length; i += 50) {
        const batch = fileIDs.slice(i, i + 50)
        const res = await cloud.getTempFileURL({ fileList: batch })
        for (const item of (res.fileList || [])) {
          if (item.tempFileURL) urlMap[item.fileID] = item.tempFileURL
        }
      }
    }
    const list = need.map((r) => ({
      _id: r._id,
      name: r.name,
      fileID: r.fileID || r.video,
      tempURL: urlMap[r.fileID || r.video] || '',
    }))
    return { total: all.length, needSkeleton: list.length, list }
  }

  // 4. 写回骨骼 fileID
  if (event && event.action === 'updateSkeleton') {
    await db.collection(COLLECTION).doc(event.id).update({
      data: { skeletonFileID: event.skeletonFileID }
    })
    return { ok: true, id: event.id }
  }

  // 5. 上传骨骼 JSON 内容到云存储，再写回数据库
  if (event && event.action === 'uploadSkeleton') {
    const cloudPath = `skeleton/${event.name}_coco17.json`
    // 将 JSON 字符串写成 Buffer 上传
    const buffer = Buffer.from(event.content, 'utf-8')
    const uploadRes = await cloud.uploadFile({
      cloudPath,
      fileContent: buffer,
    })
    const fileID = uploadRes.fileID
    // 写回数据库
    await db.collection(COLLECTION).doc(event.id).update({
      data: { skeletonFileID: fileID }
    })
    return { ok: true, id: event.id, skeletonFileID: fileID }
  }

  // 6. 按文件名匹配：遍历 videos 集合，拼出 skeleton/{name}_coco17.json 的 fileID 并写回
  //    前提：你已手动把 JSON 文件上传到云存储 skeleton/ 目录下
  if (event && event.action === 'matchSkeleton') {
    const all = await fetchAll()
    const env = cloud.DYNAMIC_CURRENT_ENV
    // 获取当前环境信息来拼 fileID 前缀
    // cloud:// fileID 格式: cloud://环境ID.存储桶后缀/路径
    // 我们用一个已有记录的 fileID 来提取前缀
    let prefix = ''
    for (const r of all) {
      const fid = r.fileID || r.video || ''
      if (fid.startsWith('cloud://')) {
        // 取到第一个 / 之前（含 /）作为前缀
        const slashIdx = fid.indexOf('/', 8) // cloud:// 后面第一个 /
        if (slashIdx > 0) {
          prefix = fid.substring(0, slashIdx + 1)
        }
        break
      }
    }
    if (!prefix) {
      return { error: '无法推断云存储前缀，请确保 videos 集合中有 fileID' }
    }

    let updated = 0
    let skipped = 0
    const results = []
    for (const r of all) {
      if (r.skeletonFileID) {
        skipped++
        continue
      }
      // 用视频名字拼骨骼 JSON 的 fileID
      const name = (r.name || '').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 60)
      if (!name) {
        skipped++
        continue
      }
      const skeletonFileID = prefix + 'skeleton/' + name + '_coco17.json'
      try {
        await db.collection(COLLECTION).doc(r._id).update({
          data: { skeletonFileID }
        })
        updated++
        results.push({ name: r.name, skeletonFileID })
      } catch (e) {
        results.push({ name: r.name, error: e.message || String(e) })
      }
    }
    return { total: all.length, updated, skipped, results }
  }

  // === duration 相关（保持原有逻辑） ===

  // 2. 批量更新 duration
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

  // 1. 返回缺 duration 的记录
  const all = await fetchAll()
  const needFill = all.filter((r) => !r.duration || r.duration === '00:00' || r.duration.trim() === '').map((r) => ({
    _id: r._id,
    name: r.name,
    fileID: r.fileID || r.video,
  }))
  return { total: all.length, needFill: needFill.length, list: needFill }
}

// 分页拉全
async function fetchAll() {
  const MAX = 100
  const countRes = await db.collection(COLLECTION).count()
  const total = countRes.total || 0
  const all = []
  const times = Math.ceil(total / MAX)
  for (let i = 0; i < times; i++) {
    const res = await db.collection(COLLECTION).skip(i * MAX).limit(MAX).get()
    all.push(...(res.data || []))
  }
  return all
}
