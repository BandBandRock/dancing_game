d// pages/tools/fill-duration.ts
// 工具页：获取所有视频时长并批量写回云数据库
// 入口：在开发者工具地址栏输入 pages/tools/fill-duration 打开
import { resolveCloudFile } from '../../utils/cloudMedia'

Page({
  data: {
    status: '点击开始',
    currentName: '',
    progress: '',
    probeUrl: '', // 当前正在探测的视频 URL
    results: [] as { name: string; duration: string }[],
    // 内部状态
    _list: [] as any[],
    _index: 0,
    _updates: [] as { id: string; duration: string }[],
    _resolve: null as any,
  },

  async onStart() {
    this.setData({ status: '正在查询缺时长的视频...', results: [] })

    // 调云函数获取需要填充的列表
    try {
      console.log('[fill] 调用云函数 fill_duration...')
      const res: any = await wx.cloud.callFunction({ name: 'fill_duration' })
      console.log('[fill] 云函数返回:', JSON.stringify(res.result))
      const list = res.result && res.result.list
      if (!list || list.length === 0) {
        this.setData({ status: `所有 ${res.result && res.result.total} 条记录都已有时长（needFill=0）。如需强制刷新请先清空 duration 字段。` })
        return
      }
      console.log('[fill] 需要填充的记录:', list.length, '条')
      this.setData({ status: `找到 ${list.length} 条需要填充，开始逐个获取时长...` })
      this.data._list = list
      this.data._index = 0
      this.data._updates = []
      this.processNext()
    } catch (e: any) {
      console.error('[fill] 云函数调用失败:', e)
      this.setData({ status: '查询失败: ' + (e.message || JSON.stringify(e)) })
    }
  },

  async processNext() {
    const list = this.data._list
    const idx = this.data._index

    if (idx >= list.length) {
      // 全部探测完毕，批量写回
      this.setData({ status: `探测完成，正在批量写回 ${this.data._updates.length} 条...`, probeUrl: '' })
      await this.batchUpdate()
      return
    }

    const item = list[idx]
    this.setData({
      currentName: item.name,
      progress: `${idx + 1} / ${list.length}`,
    })

    // 解析 fileID → 临时 URL
    try {
      const url = await resolveCloudFile(item.fileID)
      console.log(`[fill] #${idx + 1} ${item.name} URL:`, url ? url.slice(0, 80) : '(空)')
      if (!url) throw new Error('解析失败')
      // 先清空再设置，强制 video 组件重新加载
      this.setData({ probeUrl: '' })
      await new Promise((r) => setTimeout(r, 100))
      this.setData({ probeUrl: url })
      // 等待 onMeta 回调
      await new Promise((resolve) => {
        this.data._resolve = resolve
        // 超时 15 秒跳过
        setTimeout(() => {
          if (this.data._resolve) {
            console.warn(`[fill] #${idx + 1} ${item.name} 超时，未收到 loadedmetadata`)
            this.data._resolve()
            this.data._resolve = null
          }
        }, 15000)
      })
    } catch (e) {
      console.error('[fill] 跳过', item.name, e)
    }

    this.data._index++
    this.processNext()
  },

  // video 组件 loadedmetadata 回调
  onMeta(e: any) {
    const item = this.data._list[this.data._index]
    console.log(`[fill] onMeta 触发, name=${item && item.name}, e.detail=`, JSON.stringify(e.detail))
    const duration = e.detail && e.detail.duration // 秒数
    console.log(`[fill] 解析到时长(秒):`, duration)
    if (duration && duration > 0) {
      const formatted = this.formatDuration(duration)
      console.log(`[fill] → ${item.name}: ${formatted}`)
      this.data._updates.push({ id: item._id, duration: formatted })
      const results = [...this.data.results, { name: item.name, duration: formatted }]
      this.setData({ results })
    } else {
      console.warn(`[fill] ${item && item.name}: duration 无效`, duration)
    }
    // 通知 processNext 继续
    if (this.data._resolve) {
      this.data._resolve()
      this.data._resolve = null
    }
  },

  formatDuration(seconds: number): string {
    const s = Math.round(seconds)
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m < 10 ? '0' + m : m}:${sec < 10 ? '0' + sec : sec}`
  },

  async batchUpdate() {
    const updates = this.data._updates
    if (updates.length === 0) {
      this.setData({ status: '没有需要更新的记录' })
      return
    }
    try {
      const res: any = await wx.cloud.callFunction({
        name: 'fill_duration',
        data: { updates },
      })
      this.setData({ status: `全部完成！更新了 ${res.result.updated} 条` })
    } catch (e: any) {
      this.setData({ status: '批量写回失败: ' + (e.message || JSON.stringify(e)) })
    }
  },
})
