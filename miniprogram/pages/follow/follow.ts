// follow.ts — 最爱舞曲列表（从收藏键值对 + 全部歌曲匹配构建）
const VIDEO_BASE = 'http://127.0.0.1:8081/video/'

function resolveVideo(video: string): string {
  if (video.includes('://') || video.includes('/')) return video
  return VIDEO_BASE + video
}

interface Song {
  name: string
  artist: string
  type: string
  duration: string
  video: string
}

// 所有内置歌曲
const ALL_SONGS: Song[] = [
  { name: '爱如毒酒', artist: '海生', type: '广场舞', duration: '03:32', video: 'https://dancing-1253975745.cos.ap-guangzhou.myqcloud.com/v1_coco17.mp4' },
  { name: '小苹果', artist: '筷子兄弟', type: '广场舞', duration: '03:22', video: 'gcd-02.mp4' },
  { name: '荷塘月色', artist: '凤凰传奇', type: '广场舞', duration: '03:53', video: 'gcd-03.mp4' },
  { name: '酒醉的蝴蝶', artist: '崔伟立', type: '广场舞', duration: '03:45', video: 'gcd-04.mp4' },
  { name: '站在草原望北京', artist: '乌兰图雅', type: '广场舞', duration: '03:28', video: 'gcd-05.mp4' },
  { name: '自由飞翔', artist: '凤凰传奇', type: '广场舞', duration: '03:57', video: 'gcd-06.mp4' },
  { name: '月亮之上', artist: '凤凰传奇', type: '广场舞', duration: '03:46', video: 'gcd-07.mp4' },
  { name: '套马杆', artist: '乌兰图雅', type: '广场舞', duration: '03:39', video: 'gcd-08.mp4' },
  { name: '火火的姑娘', artist: '东方红艳', type: '广场舞', duration: '03:36', video: 'gcd-09.mp4' },
  { name: '江南Style', artist: '蔡依林', type: '广场舞', duration: '03:44', video: 'gcd-10.mp4' },
  { name: '山路十八弯', artist: '李琼', type: '广场舞', duration: '03:28', video: 'gcd-11.mp4' },
  { name: '九妹', artist: '黄鹤翔', type: '广场舞', duration: '03:42', video: 'gcd-12.mp4' },
  { name: '北江美', artist: '刘小路', type: '交谊舞', duration: '04:10', video: 'jyx-01.mp4' },
  { name: '心雨', artist: '杨钰莹', type: '交谊舞', duration: '04:16', video: 'jyx-02.mp4' },
  { name: '走四方', artist: '韩磊', type: '交谊舞', duration: '04:08', video: 'jyx-03.mp4' },
  { name: '南屏晚钟', artist: '蔡琴', type: '交谊舞', duration: '04:22', video: 'jyx-04.mp4' },
  { name: '甜蜜蜜', artist: '邓丽君', type: '交谊舞', duration: '03:28', video: 'jyx-05.mp4' },
  { name: '难忘今宵', artist: '李谷一', type: '交谊舞', duration: '03:58', video: 'jyx-06.mp4' },
  { name: '友谊地久天长', artist: '黑鸭子', type: '交谊舞', duration: '03:35', video: 'jyx-07.mp4' },
  { name: '月亮代表我的心', artist: '邓丽君', type: '交谊舞', duration: '03:30', video: 'jyx-08.mp4' },
  { name: '一剪梅', artist: '费玉清', type: '交谊舞', duration: '03:50', video: 'jyx-09.mp4' },
  { name: '彩云追月', artist: '张也', type: '交谊舞', duration: '03:44', video: 'jyx-10.mp4' },
  { name: '渔光曲', artist: '腾格尔', type: '交谊舞', duration: '04:02', video: 'jyx-11.mp4' },
  { name: '何日君再来', artist: '邓丽君', type: '交谊舞', duration: '03:25', video: 'jyx-12.mp4' },
  { name: '多谢了', artist: '龚玥', type: '民族舞', duration: '04:02', video: 'mz-01.mp4' },
  { name: '我从草原来', artist: '凤凰传奇', type: '民族舞', duration: '03:48', video: 'mz-02.mp4' },
  { name: '美丽的草原我的家', artist: '德德玛', type: '民族舞', duration: '03:55', video: 'mz-03.mp4' },
  { name: '青藏高原', artist: '韩红', type: '民族舞', duration: '03:48', video: 'mz-04.mp4' },
  { name: '茉莉花', artist: '宋祖英', type: '民族舞', duration: '03:30', video: 'mz-05.mp4' },
  { name: '康定情歌', artist: '降央卓玛', type: '民族舞', duration: '03:42', video: 'mz-06.mp4' },
  { name: '敖包相会', artist: '刀郎', type: '民族舞', duration: '03:38', video: 'mz-07.mp4' },
  { name: '掀起你的盖头来', artist: '克里木', type: '民族舞', duration: '03:20', video: 'mz-08.mp4' },
  { name: '阿里山的姑娘', artist: '卓依婷', type: '民族舞', duration: '03:33', video: 'mz-09.mp4' },
  { name: '月光下的凤尾竹', artist: '葫芦丝', type: '民族舞', duration: '04:10', video: 'mz-10.mp4' },
  { name: '山丹丹开花红艳艳', artist: '阿宝', type: '民族舞', duration: '03:52', video: 'mz-11.mp4' },
  { name: '天路', artist: '韩红', type: '民族舞', duration: '04:18', video: 'mz-12.mp4' },
  { name: '全民养生操', artist: '健身舞曲', type: '养生操', duration: '05:20', video: 'js-01.mp4' },
  { name: '本草纲目', artist: '刘畊宏', type: '养生操', duration: '03:30', video: 'js-02.mp4' },
  { name: '龙拳', artist: '周杰伦', type: '养生操', duration: '04:00', video: 'js-03.mp4' },
  { name: '快乐崇拜', artist: '潘玮柏', type: '养生操', duration: '03:45', video: 'js-04.mp4' },
  { name: '健康歌', artist: '范晓萱', type: '养生操', duration: '03:20', video: 'js-05.mp4' },
  { name: '站在高岗上', artist: '张惠妹', type: '养生操', duration: '03:38', video: 'js-06.mp4' },
  { name: '卡路里', artist: '火箭少女101', type: '养生操', duration: '03:05', video: 'js-07.mp4' },
  { name: '兔子舞', artist: '儿童健身', type: '养生操', duration: '03:15', video: 'js-08.mp4' },
  { name: '本草纲目(完整版)', artist: '龙拳组合', type: '养生操', duration: '05:10', video: 'js-09.mp4' },
  { name: '向快乐出发', artist: '健身舞曲', type: '养生操', duration: '04:30', video: 'js-10.mp4' },
  { name: '啦啦操进行曲', artist: '健身舞曲', type: '养生操', duration: '04:05', video: 'js-11.mp4' },
  { name: '最炫养生操', artist: '广场舞曲', type: '养生操', duration: '04:48', video: 'js-12.mp4' },
  { name: '鬼步舞串烧', artist: 'DJ舞曲', type: '鬼步舞', duration: '06:05', video: 'gb-01.mp4' },
  { name: '电音之王', artist: 'DJ舞曲', type: '鬼步舞', duration: '05:30', video: 'gb-02.mp4' },
  { name: '踏浪(鬼步版)', artist: '网络DJ', type: '鬼步舞', duration: '04:20', video: 'gb-03.mp4' },
  { name: 'Sandstorm', artist: 'Darude', type: '鬼步舞', duration: '03:45', video: 'gb-04.mp4' },
  { name: '野狼disco', artist: '宝石Gem', type: '鬼步舞', duration: '03:58', video: 'gb-05.mp4' },
  { name: '沙漠骆驼', artist: '展展与罗罗', type: '鬼步舞', duration: '04:35', video: 'gb-06.mp4' },
  { name: '社会摇', artist: '萧全', type: '鬼步舞', duration: '03:40', video: 'gb-07.mp4' },
  { name: '海草舞', artist: '萧全', type: '鬼步舞', duration: '03:30', video: 'gb-08.mp4' },
  { name: '惊雷', artist: '快手DJ', type: '鬼步舞', duration: '04:10', video: 'gb-09.mp4' },
  { name: '摇摇摇', artist: '鬼步DJ', type: '鬼步舞', duration: '05:00', video: 'gb-10.mp4' },
  { name: '逆战(鬼步版)', artist: '张杰', type: '鬼步舞', duration: '04:12', video: 'gb-11.mp4' },
  { name: '倍儿爽', artist: '大张伟', type: '鬼步舞', duration: '03:25', video: 'gb-12.mp4' },
]

function getAllSongs(): Song[] {
  const uploadList = wx.getStorageSync('uploaded_videos')
  const list = Array.isArray(uploadList) ? uploadList : []
  const uploaded: Song[] = list.map((item: any) => ({
    name: item.name,
    artist: '用户上传',
    type: item.type || '未分类',
    duration: item.duration || '00:00',
    video: item.video,
  }))
  return [...ALL_SONGS, ...uploaded]
}

Component({
  data: {
    keyword: '',
    musicList: [] as Song[],
    filteredList: [] as Song[],
  },

  lifetimes: {
    attached() {
      this.loadFavorites()
    },
  },

  pageLifetimes: {
    show() {
      this.loadFavorites()
    },
  },

  methods: {
    loadFavorites() {
      // 从 favorite_songs 键值对读取所有已收藏的歌曲 key
      const favKeys = wx.getStorageSync('favorite_songs')
      if (!favKeys || typeof favKeys !== 'object' || Array.isArray(favKeys)) {
        this.setData({ musicList: [], filteredList: [] })
        return
      }

      const allSongs = getAllSongs()
      const result: Song[] = []
      for (const key of Object.keys(favKeys)) {
        if (!favKeys[key]) continue
        const [name, type] = key.split('|')
        const song = allSongs.find((s) => s.name === name && s.type === type)
        if (song) result.push(song)
      }

      this.setData({ musicList: result, filteredList: result })
    },

    onSearchInput(e: any) {
      const keyword = e.detail.value.toLowerCase()
      this.setData({ keyword })
      const filtered = this.data.musicList.filter(
        (item) => item.name.toLowerCase().includes(keyword) || item.artist.toLowerCase().includes(keyword) || item.type.toLowerCase().includes(keyword)
      )
      this.setData({ filteredList: filtered })
    },

    onMusicTap(e: any) {
      const index = e.currentTarget.dataset.index
      const list = this.data.filteredList
      if (index === undefined || index < 0 || index >= list.length) return
      const song = list[index]
      if (!song) return
      const videoUrl = resolveVideo(song.video)
      wx.navigateTo({
        url: `../dance_search/dance_search?video=${encodeURIComponent(videoUrl)}&song=${encodeURIComponent(song.name)}&type=${encodeURIComponent(song.type)}`,
      })
    },

    // 取消收藏
    removeFavorite(e: any) {
      const index = e.currentTarget.dataset.index
      const list = this.data.filteredList
      if (index === undefined || index < 0 || index >= list.length) return
      const song = list[index]
      if (!song) return

      const key = song.name + '|' + song.type

      // 从键值对移除
      const favKeys = wx.getStorageSync('favorite_songs') || {}
      if (typeof favKeys === 'object' && !Array.isArray(favKeys)) {
        delete favKeys[key]
        wx.setStorageSync('favorite_songs', favKeys)
      }

      // 也从列表移除（兼容旧数据）
      const favList = wx.getStorageSync('favorite_songs_list')
      if (favList && Array.isArray(favList)) {
        const newList = favList.filter((item: any) => (item.name + '|' + item.type) !== key)
        wx.setStorageSync('favorite_songs_list', newList)
      }

      // 刷新列表
      this.loadFavorites()
      wx.showToast({ title: '取消收藏', icon: 'none' })
    },
  },
})
