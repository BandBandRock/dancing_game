// follow.ts
interface MusicItem {
  id: number
  title: string
  style: string
  duration: string
  emoji: string
  liked: boolean
}

Component({
  data: {
    keyword: '',
    musicList: [] as MusicItem[],
    filteredList: [] as MusicItem[],
  },

  lifetimes: {
    attached() {
      this.loadMusicList()
    },
  },

  methods: {
    loadMusicList() {
      const list: MusicItem[] = [
        { id: 1, title: '蓝色多瑙河', style: '华尔兹', duration: '9:32', emoji: '💙', liked: true },
        { id: 2, title: '一步之遥', style: '探戈', duration: '3:45', emoji: '💃', liked: true },
        { id: 3, title: '春之声圆舞曲', style: '维也纳华尔兹', duration: '7:15', emoji: '🌸', liked: true },
        { id: 4, title: '卡门序曲', style: '斗牛', duration: '2:18', emoji: '🐂', liked: true },
        { id: 5, title: '月亮代表我的心', style: '伦巴', duration: '4:20', emoji: '🌙', liked: true },
        { id: 6, title: '小苹果', style: '广场舞', duration: '3:28', emoji: '🍎', liked: false },
        { id: 7, title: '最炫民族风', style: '民族风', duration: '4:05', emoji: '💨', liked: true },
        { id: 8, title: '天鹅湖', style: '芭蕾', duration: '12:00', emoji: '🦢', liked: true },
        { id: 9, title: '爱的华尔兹', style: '华尔兹', duration: '5:10', emoji: '💕', liked: true },
        { id: 10, title: '西班牙斗牛士', style: '斗牛', duration: '3:55', emoji: '🇪🇸', liked: true },
      ]
      this.setData({ musicList: list, filteredList: list })
    },

    onSearchInput(e: any) {
      const keyword = e.detail.value.toLowerCase()
      this.setData({ keyword })
      const filtered = this.data.musicList.filter(
        (item) => item.title.toLowerCase().includes(keyword) || item.style.toLowerCase().includes(keyword)
      )
      this.setData({ filteredList: filtered })
    },

    toggleLike(e: any) {
      const id = e.currentTarget.dataset.id
      const list = this.data.musicList.map((item) => {
        if (item.id === id) {
          return { ...item, liked: !item.liked }
        }
        return item
      })
      const filtered = list.filter(
        (item) => item.title.toLowerCase().includes(this.data.keyword) || item.style.toLowerCase().includes(this.data.keyword)
      )
      this.setData({ musicList: list, filteredList: filtered })
    },
  },
})
