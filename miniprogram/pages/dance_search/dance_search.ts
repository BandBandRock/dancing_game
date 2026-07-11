// dance_search.ts 舞种搜索落地页
// ============================================================
// 视频 meta 全部来自云数据库集合 `videos`，视频文件存云存储。
// 页面不再 hardcode 任何视频数据，onLoad 时通过 videoRepo 从云端拉取。
// video 字段即 cloud:// fileID，播放前用 resolveCloudFile 解析成临时 https 地址。
// ============================================================
import { resolveCloudFile } from '../../utils/cloudMedia'
import { fetchVideos, VideoMeta } from '../../utils/videoRepo'

type Song = VideoMeta

// 把 fileID 解析成可播放的临时 https 地址
function playVideo(fileID: string) {
  return resolveCloudFile(fileID)
}

Component({
  data: {
    keyword: '',
    activeType: '全部',
    types: ['全部', '广场舞', '交谊舞', '民族舞', '养生操', '鬼步舞'],
    songs: [] as Song[],
    filtered: [] as Song[],
    loading: false,
    showVideo: false,
    currentVideo: '',
    currentSong: '',
    currentType: '',
    subTitle: '',
    isScoped: false,
    videoFull: false, // true=满屏播放（推荐视频），false=居中卡片（歌曲）
    rate: 0.8,
    shaking: {
      rate05: false,
      rate08: false,
    },
    fireworkActive: false,
    showPraise: false,
    // 收藏状态
    favoritedKeys: {} as Record<string, boolean>,
  },
  methods: {
    async onLoad(options: any) {
      // 加载收藏状态
      this.loadFavorites()

      // 从首页带舞种参数跳进来：?type=广场舞
      if (options && options.type) {
        const type = decodeURIComponent(options.type)
        this.setData({
          activeType: type,
          subTitle: type,
          isScoped: true,
          currentType: type,
        })

        // 从搜索结果页跳过来，直接打开视频（video 已是 cloud:// fileID）
        if (options.video) {
          const video = decodeURIComponent(options.video)
          const song = options.song ? decodeURIComponent(options.song) : ''
          playVideo(video).then((url) => {
            this.setData({
              currentVideo: url,
              currentSong: song,
              currentType: type,
              videoFull: false,
              showVideo: true,
              rate: 0.8,
            })
          })
        }
      }

      // 从云数据库拉取视频列表
      await this.loadVideos()
    },

    // 从云数据库拉取视频列表并渲染
    async loadVideos() {
      this.setData({ loading: true })
      try {
        const songs = await fetchVideos()
        this.setData({ songs })
        console.log('[dance_search] 云端视频数量:', songs.length)
      } catch (e) {
        console.error('[dance_search] 拉取视频失败', e)
        wx.showToast({ title: '加载失败，请重试', icon: 'none' })
      } finally {
        this.setData({ loading: false })
        this.applyFilter()
      }
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

      // 从 songs 里找到对应歌曲信息
      const filtered = this.data.filtered
      if (index === undefined || index < 0 || index >= filtered.length) return
      const song = filtered[index]

      const fav = { ...this.data.favoritedKeys }
      if (fav[key]) {
        delete fav[key]
        // 也从收藏列表中移除
        const list = wx.getStorageSync('favorite_songs_list') || []
        const arr = Array.isArray(list) ? list : []
        const newList = arr.filter((item: any) => (item.name + '|' + item.type) !== key)
        wx.setStorageSync('favorite_songs_list', newList)
        wx.showToast({ title: '取消收藏', icon: 'none' })
      } else {
        fav[key] = true
        // 保存完整的歌曲信息到收藏列表
        this.saveFavoriteSong(song)
        wx.showToast({ title: '已收藏', icon: 'success' })
      }
      this.setData({ favoritedKeys: fav })
      wx.setStorageSync('favorite_songs', fav)
    },

    // 保存收藏的完整歌曲信息
    saveFavoriteSong(song: any) {
      const list = wx.getStorageSync('favorite_songs_list') || []
      const arr = Array.isArray(list) ? list : []
      // 不重复添加
      const key = song.name + '|' + song.type
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
    },

    // 搜索输入
    onSearchInput(e: any) {
      this.setData({ keyword: e.detail.value })
      this.applyFilter()
    },

    // 清空搜索
    onClear() {
      this.setData({ keyword: '' })
      this.applyFilter()
    },

    // 切换歌曲类型
    onTypeTap(e: any) {
      const type = e.currentTarget.dataset.type as string
      this.setData({ activeType: type })
      this.applyFilter()
    },

    // 点击歌曲 → 播放对应视频（居中卡片样式）
    onSongTap(e: any) {
      const index = e.currentTarget.dataset.index
      const filtered = this.data.filtered
      if (index === undefined || index < 0 || index >= filtered.length) return
      const song = filtered[index]
      if (!song) return
      // song.video 即 cloud:// fileID，解析成临时 https 播放
      playVideo(song.video).then((url) => {
        this.setData({
          currentVideo: url,
          currentSong: song.name,
          currentType: song.type,
          videoFull: false,
          showVideo: true,
          rate: 0.8,
          fireworkActive: false,
          showPraise: false,
        })
        this.data._fireReady = false
      })
    },

    // 去跳舞：带当前视频跳转姿态识别页（主体播视频，右下角摄像头识别）
    onGoDance() {
      if (!this.data.currentVideo) return
      wx.navigateTo({
        url:
          `../pose/pose?video=${encodeURIComponent(this.data.currentVideo)}` +
          `&song=${encodeURIComponent(this.data.currentSong)}` +
          `&type=${encodeURIComponent(this.data.currentType)}` +
          `&rate=${this.data.rate}`,
      })
    },

    // 关闭视频
    onCloseVideo() {
      this.stopFirework()
      this.setData({ showVideo: false, currentVideo: '', currentSong: '', currentType: '', videoFull: false, rate: 0.8, fireworkActive: false, showPraise: false })
    },

    // 视频播放结束 → 礼花 + 你真棒
    onVideoEnded() {
      this.setData({ fireworkActive: true, showPraise: true })
      setTimeout(() => this.prepFireCanvas(), 100)
    },

    // ===== 礼花粒子系统 =====
    _fireTimer: 0 as any,
    _fireCtx: null as any,
    _fireCanvas: null as any,
    _fireCW: 0,
    _fireCH: 0,
    _fireParticles: [] as any[],
    _fireReady: false,

    prepFireCanvas() {
      if (this.data._fireReady) { this.fireBoom(); return }
      const query = this.createSelectorQuery()
      query.select('#fireworkCanvas')
        .fields({ node: true, size: true })
        .exec((res: any) => {
          if (!res || !res[0] || !res[0].node) return
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getSystemInfoSync().pixelRatio || 1
          canvas.width = res[0].width * dpr
          canvas.height = res[0].height * dpr
          ctx.scale(dpr, dpr)
          this.data._fireCanvas = canvas
          this.data._fireCtx = ctx
          this.data._fireCW = res[0].width
          this.data._fireCH = res[0].height
          this.data._fireReady = true
          this.fireBoom()
        })
    },

    fireBoom() {
      const ctx = this.data._fireCtx
      if (!ctx) return
      this.data._fireParticles = []
      const cx = this.data._fireCW / 2
      const cy = this.data._fireCH / 2
      const colors = ['#FF3B30','#FF9500','#FFCC00','#34C759','#007AFF','#AF52DE','#FF2D55','#5AC8FA','#FFD60A','#FF6B35']

      for (let i = 0; i < 60; i++) {
        const angle = (Math.PI * 2 * i) / 60 + (Math.random() - 0.5) * 0.3
        const speed = 5 + Math.random() * 9
        this.data._fireParticles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 3,
          r: 3 + Math.random() * 5,
          color: colors[Math.floor(Math.random() * colors.length)],
          life: 70 + Math.random() * 40,
          gravity: 0.1,
          shrink: 0.96,
        })
      }

      let round = 0
      clearInterval(this.data._fireTimer)
      this.data._fireTimer = setInterval(() => {
        round++
        for (let i = 0; i < 6; i++) {
          const angle = Math.random() * Math.PI * 2
          const speed = 2 + Math.random() * 4
          this.data._fireParticles.push({
            x: cx + (Math.random() - 0.5) * 50,
            y: cy + (Math.random() - 0.5) * 30,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1,
            r: 2 + Math.random() * 2,
            color: colors[Math.floor(Math.random() * colors.length)],
            life: 35 + Math.random() * 20,
            gravity: 0.07,
            shrink: 0.94,
          })
        }
        if (round >= 30) { this.stopFirework() }
      }, 80) as unknown as number

      this.fireAnimate()
    },

    fireAnimate() {
      const ctx = this.data._fireCtx
      const canvas = this.data._fireCanvas
      if (!ctx || !canvas) return
      const w = this.data._fireCW
      const h = this.data._fireCH
      const particles = this.data._fireParticles

      ctx.clearRect(0, 0, w, h)
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]
        p.x += p.vx
        p.vy += p.gravity
        p.y += p.vy
        p.r *= p.shrink
        p.life--
        if (p.life <= 0 || p.r < 0.2) { particles.splice(i, 1); continue }
        ctx.globalAlpha = Math.min(1, p.life / 15)
        ctx.fillStyle = p.color
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
        ctx.globalAlpha = Math.min(0.5, p.life / 40)
        ctx.beginPath(); ctx.arc(p.x - p.vx * 1.5, p.y - p.vy * 1.5, p.r * 0.5, 0, Math.PI * 2); ctx.fill()
      }

      if (particles.length > 0 || this.data._fireTimer) {
        canvas.requestAnimationFrame(() => this.fireAnimate())
      }
    },

    stopFirework() {
      if (this.data._fireTimer) { clearInterval(this.data._fireTimer); this.data._fireTimer = 0 }
      this.data._fireParticles = []
      const ctx = this.data._fireCtx
      if (ctx) { ctx.clearRect(0, 0, this.data._fireCW, this.data._fireCH) }
      this.setData({ fireworkActive: false, showPraise: false })
    },

    // 切换播放倍速
    setRate(e: any) {
      const rate = Number(e.currentTarget.dataset.rate)
      if (rate === this.data.rate) return

      // 按钮颤动 key
      const keyMap: Record<number, string> = { 0.5: 'rate05', 0.8: 'rate08' }
      const key = keyMap[rate]
      if (key) {
        this.setData({ [`shaking.${key}`]: true })
        setTimeout(() => {
          this.setData({ [`shaking.${key}`]: false })
        }, 350)
      }

      this.setData({ rate }, () => {
        const videoCtx = wx.createVideoContext('danceVideo', this)
        console.log('[setRate] rate:', rate, 'videoCtx:', !!videoCtx)
        videoCtx.playbackRate(rate)
      })
    },

    // 关键词 + 类型 过滤
    applyFilter() {
      const kw = this.data.keyword.trim().toLowerCase()
      const type = this.data.activeType
      const list = this.data.songs.filter((s) => {
        const matchType = type === '全部' || s.type === type
        const matchKw =
          !kw ||
          s.name.toLowerCase().includes(kw) ||
          s.artist.toLowerCase().includes(kw) ||
          s.type.toLowerCase().includes(kw)
        return matchType && matchKw
      })
      this.setData({ filtered: list })
    },
  },
})
