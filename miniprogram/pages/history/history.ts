// history.ts 我的跳舞历史
import {
  getHistory,
  clearHistory,
  setHistory,
  DanceRecord,
} from '../../utils/danceHistory'

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function pad(n: number): string {
  return n < 10 ? '0' + n : '' + n
}

// 列表展示用的派生字段（wxml 不便计算，提前算好）
interface DisplayRecord extends DanceRecord {
  dateText: string // 07-10 周四
  timeText: string // 14:30 开始
  scoreText: string // 平均分 96
}

Component({
  data: {
    list: [] as DisplayRecord[],
    totalCount: 0,
    // 选择删除相关
    selecting: false, // 是否处于“选择模式”（每项出现小圆圈）
    selectedMap: {} as Record<string, boolean>, // 已选中的记录 id
    selectedCount: 0, // 已选中数量
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

    loadRecords() {
      // 读取本地记录（默认空，跳舞后由跳舞页 addHistory 写入）
      const stored = getHistory()
      // 过滤掉早期遗留的示例数据（id 以 seed_ 开头），并清出存储
      const raw = stored.filter((r) => !String(r.id || '').startsWith('seed_'))
      if (raw.length !== stored.length) {
        setHistory(raw)
      }
      const list: DisplayRecord[] = raw.map((r) => {
        const d = new Date(r.date + 'T00:00:00')
        const w = WEEK[d.getDay()]
        return {
          ...r,
          dateText: `${r.date.slice(5)} 周${w}`,
          timeText: `${pad(r.hour)}:${pad(r.minute)} 开始`,
          scoreText: `平均分 ${r.score}`,
        }
      })
      // 跳舞次数 = 记录条数（空时为 0，每录一次 +1）
      const totalCount = list.length
      this.setData({ list, totalCount })
    },

    // 点击视频封面 → 跳转独立全屏播放页（选择模式下不触发，避免误操作）
    onPlay(e: any) {
      if (this.data.selecting) return
      const id = e.currentTarget.dataset.id as string
      const rec = this.data.list.find((r) => r.id === id)
      if (!rec) return
      wx.navigateTo({
        url:
          '/pages/playvideo/playvideo?video=' +
          encodeURIComponent(rec.video) +
          '&song=' +
          encodeURIComponent(rec.song),
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
            // 保留未选中的，写回存储
            const remain = getHistory().filter((r) => !ids.includes(r.id))
            setHistory(remain)
            wx.showToast({ title: '已删除', icon: 'success' })
            this.setData({ selecting: false, selectedMap: {}, selectedCount: 0 })
            this.loadRecords()
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
            clearHistory()
            this.loadRecords()
          }
        },
      })
    },
  },
})
