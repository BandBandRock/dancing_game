// rank.ts
interface RankItem {
  id: number
  rank: number
  name: string
  avatar: string
  style: string
  level: string
  hours: number
  score: number
  displayValue: string
  unit: string
}

// avatar 存的是背景色值

const NAMES = [
  '张秀兰', '李桂英', '王美华', '赵玉芬', '陈淑珍',
  '刘翠花', '杨凤莲', '黄丽娟', '周月娥', '吴瑞芳',
  '郑雅琴', '孙巧云', '朱慧敏', '马晓红', '胡金凤',
]

const STYLES = ['华尔兹', '探戈', '广场舞', '民族舞', '伦巴', '恰恰', '快步', '养生操']

const LEVELS = ['高级', '中级', '初级', '资深', '新人']

const AVATAR_COLORS = [
  '#e57373', '#f06292', '#ba68c8', '#9575cd', '#7986cb',
  '#64b5f6', '#4fc3f7', '#4dd0e1', '#4db6ac', '#81c784',
  '#aed581', '#ffd54f', '#ffb74d', '#ff8a65', '#a1887f',
]

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function genList(): RankItem[] {
  const list: RankItem[] = []
  for (let i = 0; i < 15; i++) {
    const hours = rand(5, 160)
    const score = rand(50, 99)
    list.push({
      id: i + 1,
      rank: 0,
      name: NAMES[i],
      avatar: AVATAR_COLORS[i],
      style: STYLES[i % STYLES.length],
      level: LEVELS[i % LEVELS.length],
      hours,
      score,
      displayValue: '',
      unit: '',
    })
  }
  return list
}

function sortByHours(list: RankItem[]): RankItem[] {
  return list.slice().sort((a, b) => b.hours - a.hours).map((item, i) => ({
    ...item,
    rank: i + 1,
    displayValue: `${item.hours}`,
    unit: '小时',
  }))
}

function sortByScore(list: RankItem[]): RankItem[] {
  return list.slice().sort((a, b) => b.score - a.score).map((item, i) => ({
    ...item,
    rank: i + 1,
    displayValue: `${item.score}`,
    unit: '分',
  }))
}

const BASE_LIST = genList()

Component({
  data: {
    tabIndex: 0,
    displayList: [] as RankItem[],
    myRank: 1,
    shaking: {
      duration: false,
      score: false,
    },
  },

  lifetimes: {
    attached() {
      this.loadList(0)
    },
  },

  methods: {
    loadList(index: number) {
      let list: RankItem[]
      if (index === 0) {
        list = sortByHours(BASE_LIST)
      } else {
        list = sortByScore(BASE_LIST)
      }
      const myRank = list.findIndex((item) => item.id === 1) + 1
      this.setData({
        tabIndex: index,
        displayList: list,
        myRank: myRank > 0 ? myRank : 1,
      })
    },

    switchDuration() {
      if (this.data.tabIndex === 0) return
      this.setData({ 'shaking.duration': true })
      this.loadList(0)
      setTimeout(() => {
        this.setData({ 'shaking.duration': false })
      }, 350)
    },

    switchScore() {
      if (this.data.tabIndex === 1) return
      this.setData({ 'shaking.score': true })
      this.loadList(1)
      setTimeout(() => {
        this.setData({ 'shaking.score': false })
      }, 350)
    },
  },
})
