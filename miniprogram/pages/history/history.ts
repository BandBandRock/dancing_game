// history.ts
interface LoginRecord {
  id: number
  date: string
  time: string
  duration: string
  icon: string
  thanks: string
}

Component({
  data: {
    records: [] as LoginRecord[],
    totalCount: 0,
    totalHours: 0,
  },

  lifetimes: {
    attached() {
      this.loadRecords()
    },
  },

  methods: {
    loadRecords() {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1
      const day = now.getDate()
      const hour = now.getHours()
      const min = now.getMinutes()

      const records: LoginRecord[] = [{
        id: 1,
        date: `${year}年${month}月${day}日`,
        time: `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`,
        duration: '—',
        icon: '🎉',
        thanks: `您在${year}年${month}月${day}日登录，祝您体验愉快`,
      }]

      const totalHours = records
        .filter(r => r.duration !== '—')
        .reduce((sum, r) => sum + parseInt(r.duration), 0)
      this.setData({
        records,
        totalCount: records.length,
        totalHours: Math.round(totalHours / 6) / 10,
      })
    },
  },
})
