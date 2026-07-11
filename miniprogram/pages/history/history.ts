// history.ts 我的跳舞历史
import {
  getHistory,
  clearHistory,
  deleteHistory,
  DanceRecord,
} from '../../utils/danceHistory'
import { resolveCloudFile } from '../../utils/cloudMedia'

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function pad(n: number): string {
  return n < 10 ? '0' + n : '' + n
}

// 列表展示用的派生字段（wxml 不便计算，提前算好）
interface DisplayRecord extends DanceRecord {
  dateText: string // 07-10 周四
  timeText: string // 14:30 开始
  scoreText: string // 平均分 96
  coverUrl: string // 录制视频封面（临时 URL，供 video poster 或 image 展示）
}

Component({
  data: {
    list: [] as DisplayRecord[],
    totalCount: 0,
    // 选择删除相关
    selecting: false, // 是否处于“选择模式”（每项出现小圆圈）
    selectedMap: {} as Record<string, boolean>, // 已选中的记录 id
    selectedCount: 0, // 已选中数量
    // 长按 5s 调试信息
    debugShow: false, // 是否显示调试浮层
    debugSong: '', // 歌曲名
    debugVideo: '', // 视频 fileID
    debugSkeleton: '', // 骨骼 JSON fileID
    debugId: '', // 记录 id
  },

  lifetimes: {
    attached() {
      this.loadRecords()
    },
  },

  methods: {
    // 返回首页（无论历史页是怎么进来的 reLaunch/navigateTo，都能稳定回首页）
    onGoHome() {
      wx.reLaunch({ url: '/pages/home/home' })
    },

    async loadRecords() {
      // 读取云端记录（默认空，跳舞后由跳舞页 addHistory 写入），最新在前
      const raw = await getHistory()
      const list: DisplayRecord[] = raw.map((r) => {
        const d = new Date(r.date + 'T00:00:00')
        const w = WEEK[d.getDay()]
        return {
          ...r,
          dateText: `${r.date.slice(5)} 周${w}`,
          timeText: `${pad(r.hour)}:${pad(r.minute)} 开始`,
          scoreText: `平均分 ${r.score}`,
          coverUrl: '', // 先占位，后面异步填充
        }
      })
      this.setData({ list, totalCount: list.length })

      // 异步解析视频封面（批量，不阻塞列表渲染）
      for (let i = 0; i < list.length; i++) {
        if (list[i].video) {
          resolveCloudFile(list[i].video).then((url) => {
            this.setData({ [`list[${i}].coverUrl`]: url })
          }).catch(() => {})
        }
      }
    },

    // 点击齿轮图标 → 弹出调试信息（显示 fileId / 骨骼 JSON fileId）
    onDebugTap(e: any) {
      if (this.data.selecting) return
      const id = e.currentTarget.dataset.id as string
      const rec = this.data.list.find((r) => r.id === id)
      if (!rec) return
      this.setData({
        debugShow: true,
        debugSong: rec.song || '（未知）',
        debugId: rec.id || '',
        debugVideo: rec.video || '（空）',
        debugSkeleton: rec.skeleton || '（无）',
      })
    },

    // 关闭调试浮层
    onDebugClose() {
      this.setData({ debugShow: false })
    },

    // 调试浮层内部点击，阻止冒泡关闭
    noop() {},

    // 调试浮层里「呈现骨骼视频」：跳转骨骼回放 demo（原始视频叠加骨骼动画）
    onOpenSkeleton() {
      const id = this.data.debugId
      const rec = this.data.list.find((r) => r.id === id)
      if (!rec) return
      if (!rec.skeleton) {
        wx.showToast({ title: '该记录无骨骼数据', icon: 'none' })
        return
      }
      wx.navigateTo({
        url:
          '/pages/skelview/skelview?video=' +
          encodeURIComponent(rec.video) +
          '&skeleton=' +
          encodeURIComponent(rec.skeleton) +
          '&teach=' +
          encodeURIComponent(rec.teach || '') +
          '&song=' +
          encodeURIComponent(rec.song),
      })
    },

    // 点击视频封面 → 跳转独立全屏播放页（选择模式下不触发，避免误操作）
    onPlay(e: any) {
      if (this.data.selecting) return
      if (this.data.debugShow) return
      const id = e.currentTarget.dataset.id as string
      const rec = this.data.list.find((r) => r.id === id)
      if (!rec) return
      wx.navigateTo({
        url:
          '/pages/playvideo/playvideo?video=' +
          encodeURIComponent(rec.video) +
          '&teach=' +
          encodeURIComponent(rec.teach || '') +
          '&song=' +
          encodeURIComponent(rec.song) +
          '&score=' +
          rec.score +
          '&date=' +
          encodeURIComponent(rec.date) +
          '&hour=' +
          rec.hour +
          '&minute=' +
          rec.minute +
          '&rate=' +
          (rec.rate || 0.8),
      })
    },

    // 点垃圾桶：未选 → 进入选择模式（每项出现小圆圈）；已选 → 删除已选中的记录
    onTrashTap() {
      if (!this.data.selecting) {
        this.setData({ selecting: true })
        return
      }
      const ids = Object.keys(this.data.selectedMap)
      if (ids.length === 0) {
        // 没选任何项，再次点击即退出选择模式
        this.setData({ selecting: false })
        return
      }
      wx.showModal({
        title: '删除记录',
        content: `确定删除选中的 ${ids.length} 条记录吗？此操作不可恢复。`,
        confirmText: '删除',
        confirmColor: '#e64340',
        success: (res) => {
          if (res.confirm) {
            // 从云端逐条删除选中的记录
            const toDelete = this.data.list.filter((r) => ids.includes(r.id))
            Promise.all(toDelete.map((r) => deleteHistory(r._id || r.id))).then(() => {
              wx.showToast({ title: '已删除', icon: 'success' })
              this.setData({ selecting: false, selectedMap: {}, selectedCount: 0 })
              this.loadRecords()
            })
          }
        },
      })
    },

    // 选择模式下点小圆圈：切换该记录的选中态
    onToggleCircle(e: any) {
      const id = e.currentTarget.dataset.id as string
      const map = { ...this.data.selectedMap }
      if (map[id]) {
        delete map[id]
      } else {
        map[id] = true
      }
      this.setData({
        selectedMap: map,
        selectedCount: Object.keys(map).length,
      })
    },

    // 取消选择模式
    onCancel() {
      this.setData({ selecting: false, selectedMap: {}, selectedCount: 0 })
    },

    // 清空历史
    onClear() {
      wx.showModal({
        title: '清空历史',
        content: '确定删除全部跳舞记录吗？此操作不可恢复。',
        confirmText: '清空',
        confirmColor: '#e64340',
        success: (res) => {
          if (res.confirm) {
            clearHistory().then(() => this.loadRecords())
          }
        },
      })
    },

    // 再跳一次
    onRedance(e: any) {
      const id = e.currentTarget.dataset.id as string
      const rec = this.data.list.find((r) => r.id === id)
      if (!rec || !rec.teach) {
        wx.showToast({ title: '无教练视频', icon: 'none' })
        return
      }
      wx.navigateTo({
        url:
          `/pages/pose/pose?video=${encodeURIComponent(rec.teach)}` +
          `&song=${encodeURIComponent(rec.song)}` +
          `&rate=${rec.rate || 0.8}`,
      })
    },

    // 分享（由 button open-type="share" 触发）
    onShareAppMessage(e: any) {
      // 尝试从触发元素获取记录 id
      const id = e && e.target && e.target.dataset && e.target.dataset.id
      const rec = id ? this.data.list.find((r) => r.id === id) : null
      if (rec) {
        return {
          title: `我跳了《${rec.song}》，平均分 ${rec.score}！快来一起跳～`,
          path:
            `pages/shared/shared?song=${encodeURIComponent(rec.song)}` +
            `&score=${rec.score}` +
            `&type=${encodeURIComponent(rec.type || '')}` +
            `&teach=${encodeURIComponent(rec.teach || '')}` +
            `&video=${encodeURIComponent(rec.video || '')}` +
            `&rate=${rec.rate || 0.8}` +
            `&date=${encodeURIComponent(rec.date || '')}`,
        }
      }
      return {
        title: '来一起跳舞吧！',
        path: 'pages/home/home',
      }
    },
  },
})
