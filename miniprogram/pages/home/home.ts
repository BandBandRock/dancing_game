// home.ts
interface Song {
  name: string
  artist: string
  type: string
  duration: string
  video: string
}

const VIDEO_BASE = 'http://127.0.0.1:8081/video/'

function resolveVideo(video: string): string {
  if (video.includes('://') || video.includes('/')) return video
  return VIDEO_BASE + video
}

const ALL_SONGS: Song[] = [
  // —— 广场舞（12 首）——
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

  // —— 交谊舞（12 首）——
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

  // —— 民族舞（12 首）——
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

  // —— 健身操（12 首）——
  { name: '全民健身操', artist: '健身舞曲', type: '健身操', duration: '05:20', video: 'js-01.mp4' },
  { name: '本草纲目', artist: '刘畊宏', type: '健身操', duration: '03:30', video: 'js-02.mp4' },
  { name: '龙拳', artist: '周杰伦', type: '健身操', duration: '04:00', video: 'js-03.mp4' },
  { name: '快乐崇拜', artist: '潘玮柏', type: '健身操', duration: '03:45', video: 'js-04.mp4' },
  { name: '健康歌', artist: '范晓萱', type: '健身操', duration: '03:20', video: 'js-05.mp4' },
  { name: '站在高岗上', artist: '张惠妹', type: '健身操', duration: '03:38', video: 'js-06.mp4' },
  { name: '卡路里', artist: '火箭少女101', type: '健身操', duration: '03:05', video: 'js-07.mp4' },
  { name: '兔子舞', artist: '儿童健身', type: '健身操', duration: '03:15', video: 'js-08.mp4' },
  { name: '本草纲目(完整版)', artist: '龙拳组合', type: '健身操', duration: '05:10', video: 'js-09.mp4' },
  { name: '向快乐出发', artist: '健身舞曲', type: '健身操', duration: '04:30', video: 'js-10.mp4' },
  { name: '啦啦操进行曲', artist: '健身舞曲', type: '健身操', duration: '04:05', video: 'js-11.mp4' },
  { name: '最炫健身操', artist: '广场舞曲', type: '健身操', duration: '04:48', video: 'js-12.mp4' },

  // —— 鬼步舞（12 首）——
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

Component({
  data: {
    keyword: '',
    filtered: [] as Song[],
    favoritedKeys: {} as Record<string, boolean>,
    shaking: {
      search: false,
      ballroom: false,
      square: false,
      folk: false,
      health: false,
      debug: false,
    },
  },

  lifetimes: {
    attached() {
      this.loadFavorites()
    },
  },

  methods: {
    onSearchInput(e: any) {
      const keyword = e.detail.value
      this.setData({ keyword })
      this.applyFilter()
    },

    onClear() {
      this.setData({ keyword: '', filtered: [] })
    },

    doSearch() {
      this.setData({ 'shaking.search': true })
      setTimeout(() => {
        this.setData({ 'shaking.search': false })
      }, 350)
      this.applyFilter()
    },

    // 获取全部歌曲（内置 + 上传）
    getAllSongs() {
      const uploadList = wx.getStorageSync('uploaded_videos') || []
      const list = Array.isArray(uploadList) ? uploadList : []
      const uploaded: Song[] = list.map((item: any) => ({
        name: item.name,
        artist: '用户上传',
        type: item.type || '未分类',
        duration: item.duration || '00:00',
        video: item.video,
      }))
      return [...ALL_SONGS, ...uploaded]
    },

    // 实时匹配
    applyFilter() {
      const kw = this.data.keyword.trim().toLowerCase()
      if (!kw) { this.setData({ filtered: [] }); return }
      const allSongs = this.getAllSongs()
      const results = allSongs.filter((s) =>
        s.name.toLowerCase().includes(kw) ||
        s.artist.toLowerCase().includes(kw) ||
        s.type.includes(kw)
      )
      this.setData({ filtered: results })
    },

    // 加载收藏状态
    loadFavorites() {
      const fav = wx.getStorageSync('favorite_songs') || {}
      this.setData({ favoritedKeys: typeof fav === 'object' && !Array.isArray(fav) ? fav : {} })
    },

    // 切换收藏
    toggleFavorite(e: any) {
      const key = e.currentTarget.dataset.key as string
      const index = e.currentTarget.dataset.index
      const filtered = this.data.filtered
      if (index === undefined || index < 0 || index >= filtered.length) return
      const song = filtered[index]

      const fav = { ...this.data.favoritedKeys }
      const list = wx.getStorageSync('favorite_songs_list') || []
      const arr = Array.isArray(list) ? list : []

      if (fav[key]) {
        delete fav[key]
        const newList = arr.filter((item: any) => (item.name + '|' + item.type) !== key)
        wx.setStorageSync('favorite_songs_list', newList)
        wx.showToast({ title: '取消收藏', icon: 'none' })
      } else {
        fav[key] = true
        const exists = arr.some((item: any) => (item.name + '|' + item.type) === key)
        if (!exists) {
          arr.push({
            name: song.name,
            artist: song.artist,
            type: song.type,
            duration: song.duration,
            video: song.video,
            favoritedAt: Date.now(),
          })
          wx.setStorageSync('favorite_songs_list', arr)
        }
        wx.showToast({ title: '已收藏', icon: 'success' })
      }
      this.setData({ favoritedKeys: fav })
      wx.setStorageSync('favorite_songs', fav)
    },

    // 点击搜索结果 → 到 dance_search 打开对应视频
    onResultTap(e: any) {
      const index = e.currentTarget.dataset.index
      const filtered = this.data.filtered
      if (index === undefined || index < 0 || index >= filtered.length) return
      const song = filtered[index]
      if (!song) return
      const videoUrl = resolveVideo(song.video)
      wx.navigateTo({
        url: `../dance_search/dance_search?video=${encodeURIComponent(videoUrl)}&song=${encodeURIComponent(song.name)}&type=${encodeURIComponent(song.type)}`,
      })
    },

    goFollow() {
      wx.navigateTo({
        url: '../follow/follow',
      })
    },

    goHistory() {
      wx.navigateTo({
        url: '../history/history',
      })
    },

    goRank() {
      wx.navigateTo({
        url: '../rank/rank',
      })
    },

    goBallroom() {
      this.goDanceSearch('ballroom', '交谊舞')
    },

    goSquare() {
      this.goDanceSearch('square', '广场舞')
    },

    goFolk() {
      this.goDanceSearch('folk', '民族舞')
    },

    goHealth() {
      this.goDanceSearch('health', '健身操')
    },

    // 舞种按钮 → 跳转搜索落地页（带舞种筛选）
    goDanceSearch(_name: string, type: string) {
      wx.navigateTo({
        url: `../dance_search/dance_search?type=${encodeURIComponent(type)}`,
      })
    },

    // Debug 入口：跳转姿态识别页
    goPose() {
      this.setData({ 'shaking.debug': true })
      setTimeout(() => {
        this.setData({ 'shaking.debug': false })
      }, 500)
      wx.navigateTo({
        url: '../pose/pose',
      })
    },

    pressBtn(name: string) {
      this.setData({ [`shaking.${name}`]: true })
      setTimeout(() => {
        this.setData({ [`shaking.${name}`]: false })
      }, 350)
    },

    // 上传舞蹈
    onUploadTap() {
      const types = ['广场舞', '交谊舞', '民族舞', '健身操', '鬼步舞']
      wx.showActionSheet({
        itemList: types,
        success: (res) => {
          const danceType = types[res.tapIndex]
          // 延迟一点再调 chooseMedia，避免 actionSheet 关闭动画干扰
          setTimeout(() => this.chooseVideo(danceType), 200)
        },
        fail: () => {},
      })
    },

    chooseVideo(danceType: string) {
      wx.chooseMedia({
        count: 1,
        mediaType: ['video'],
        sourceType: ['album'],
        maxDuration: 600,
        camera: 'back',
        success: (res) => {
          const tempPath = res.tempFiles[0].tempFilePath
          // 弹出输入框让用户输入歌名
          wx.showModal({
            title: '输入歌曲名称',
            content: '请为上传的舞蹈起个名字',
            editable: true,
            placeholderText: '如：我的舞蹈作品',
            success: (modalRes) => {
              if (!modalRes.confirm) {
                // 用户点了取消，不上传
                return
              }
              let songName = (modalRes.content || '').trim()
              if (!songName) {
                // 用户没输入内容，用默认名
                songName = ''
              }
              this.uploadVideo(tempPath, danceType, songName)
            },
          })
        },
        fail: (err) => {
          console.error('[upload] chooseMedia fail', err)
          if (err.errMsg && err.errMsg.includes('cancel')) return
          wx.showToast({ title: '选择视频失败', icon: 'none' })
        },
      })
    },

    uploadVideo(filePath: string, danceType: string, songName: string) {
      wx.showLoading({ title: '处理中...', mask: true })
      const fs = wx.getFileSystemManager()
      // 尝试 saveFile 持久化，失败时直接用临时路径
      fs.saveFile({
        tempFilePath: filePath,
        success: (res) => {
          this.saveRecord(res.savedFilePath, danceType, songName)
        },
        fail: (err) => {
          console.warn('[upload] saveFile fail, use temp path', err)
          this.saveRecord(filePath, danceType, songName)
        },
      })
    },

    saveRecord(videoPath: string, danceType: string, songName: string) {
      // 获取上传列表（已有的）
      let uploadList = wx.getStorageSync('uploaded_videos') || []
      if (typeof uploadList === 'string') uploadList = []
      const shortName = songName || '上传舞蹈_' + (uploadList.length + 1)
      const record = {
        id: Date.now(),
        name: shortName,
        type: danceType,
        video: videoPath,
        duration: '00:00',
        createTime: new Date().toISOString(),
      }
      uploadList.push(record)
      wx.setStorageSync('uploaded_videos', uploadList)
      wx.hideLoading()
      wx.showToast({ title: '上传成功', icon: 'success' })
    },
  },
})
