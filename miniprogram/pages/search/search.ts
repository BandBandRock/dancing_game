// search.ts
interface SearchResult {
  id: number
  title: string
  desc: string
  icon: string
  tag: string
}

// 舞种数据库
const DANCE_DB: { keys: string[]; category: string; results: SearchResult[] }[] = [
  {
    keys: ['华尔兹', '探戈', '快步', '狐步', '恰恰', '伦巴', '桑巴', '斗牛', '牛仔', '交际舞', '维也纳'],
    category: '交际舞',
    results: [
      { id: 1, title: '蓝色多瑙河', desc: '华尔兹经典舞曲 · 3/4拍', icon: '💙', tag: '华尔兹' },
      { id: 2, title: '春之声圆舞曲', desc: '维也纳华尔兹 · 优雅旋转', icon: '🌸', tag: '维也纳华尔兹' },
      { id: 3, title: '一步之遥', desc: '探戈名曲 · 激情有力', icon: '💃', tag: '探戈' },
      { id: 4, title: '卡门序曲', desc: '斗牛舞 · 气势恢宏', icon: '🐂', tag: '斗牛' },
      { id: 5, title: '月亮代表我的心', desc: '伦巴慢舞 · 经典情歌', icon: '🌙', tag: '伦巴' },
      { id: 6, title: '爱的华尔兹', desc: '华尔兹入门 · 节奏清晰', icon: '💕', tag: '华尔兹' },
      { id: 7, title: '西班牙斗牛士', desc: '斗牛进行曲 · 热烈奔放', icon: '🇪🇸', tag: '斗牛' },
      { id: 8, title: '杜鹃圆舞曲', desc: '快步舞 · 轻快活泼', icon: '🕊️', tag: '快步' },
    ],
  },
  {
    keys: ['广场舞', '健身操', '秧歌', '扇子', '腰鼓', '拍手', '步操', '广场', '跳操'],
    category: '广场舞',
    results: [
      { id: 11, title: '小苹果', desc: '全民广场舞 · 简单易学', icon: '🍎', tag: '广场舞' },
      { id: 12, title: '最炫民族风', desc: '民族风广场舞 · 节奏欢快', icon: '💨', tag: '民族风' },
      { id: 13, title: '荷塘月色', desc: '优雅广场舞 · 动作柔美', icon: '🌺', tag: '广场舞' },
      { id: 14, title: '舞动中国', desc: '健身操 · 活力四射', icon: '🇨🇳', tag: '健身操' },
      { id: 15, title: '火红的萨日朗', desc: '秧歌舞 · 草原风情', icon: '🔥', tag: '秧歌' },
      { id: 16, title: '中国美', desc: '扇子舞 · 大气磅礴', icon: '🎋', tag: '扇子舞' },
    ],
  },
  {
    keys: ['民族舞', '蒙古', '藏族', '傣族', '彝族', '苗族', '维吾尔', '朝鲜族', '琵琶', '古筝', '二胡', '民歌'],
    category: '民族舞',
    results: [
      { id: 21, title: '赛马', desc: '蒙古舞 · 二胡名曲 · 气势如虹', icon: '🐎', tag: '蒙古舞' },
      { id: 22, title: '彩云之南', desc: '傣族舞 · 孔雀翩翩', icon: '🦚', tag: '傣族舞' },
      { id: 23, title: '掀起你的盖头来', desc: '维吾尔族舞 · 欢快热烈', icon: '💃', tag: '维吾尔族' },
      { id: 24, title: '阿里郎', desc: '朝鲜族舞 · 抒情悠扬', icon: '🏔️', tag: '朝鲜族' },
      { id: 25, title: '十面埋伏', desc: '琵琶独奏 · 中国古典', icon: '🎵', tag: '琵琶曲' },
      { id: 26, title: '高山流水', desc: '古筝名曲 · 意境深远', icon: '⛰️', tag: '古筝曲' },
    ],
  },
  {
    keys: ['太极', '八段锦', '五禽戏', '经络', '艾灸', '食疗', '冥想', '养生操', '养身', '养生', '足浴', '推拿'],
    category: '养生操',
    results: [
      { id: 31, title: '二十四式太极拳', desc: '太极拳标准套路 · 柔中带刚', icon: '☯️', tag: '太极' },
      { id: 32, title: '八段锦', desc: '古代导引术 · 舒展全身', icon: '🧘', tag: '八段锦' },
      { id: 33, title: '五禽戏', desc: '华佗养生功法 · 虎鹿熊猿鸟', icon: '🐯', tag: '五禽戏' },
      { id: 34, title: '经络拍打操', desc: '疏通经络 · 活血化瘀', icon: '👐', tag: '经络' },
      { id: 35, title: '养生食疗歌', desc: '四季食疗配方 · 养生知识', icon: '🥗', tag: '食疗' },
      { id: 36, title: '冥想放松', desc: '静心冥想 · 身心平衡', icon: '🧘', tag: '冥想' },
    ],
  },
]

Component({
  data: {
    keyword: '',
    category: '',
    results: [] as SearchResult[],
  },

  lifetimes: {
    attached() {
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      const options = (currentPage as any).options || {}
      const keyword = decodeURIComponent(options.keyword || '')
      if (keyword) {
        const match = this.findCategory(keyword)
        if (match) {
          this.setData({
            keyword,
            category: match.category,
            results: match.results,
          })
        } else {
          this.setData({ keyword, category: '未知分类' })
        }
      }
    },
  },

  methods: {
    findCategory(keyword: string) {
      const k = keyword.toLowerCase()
      for (const db of DANCE_DB) {
        for (const key of db.keys) {
          if (k.includes(key)) {
            return { category: db.category, results: db.results }
          }
        }
      }
      return null
    },
  },
})
