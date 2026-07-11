// dance_search.ts 舞种搜索落地页
interface Song {
  name: string
  artist: string
  type: string
  duration: string
  video: string // 视频文件名（不含路径），完整地址 = VIDEO_BASE + video
}

// ============================================================
// 视频基础地址（云服务器 / CDN）
// - 正式上线：把下面这行换成你的云存储 / CDN 地址，
//   例如 'https://your-bucket.cos.ap-guangzhou.myqcloud.com/video/'
//   并把该域名加入小程序后台「request 合法域名」白名单。
// - 开发预览：默认指向本地 dev-server（npm run dev:video），
//   视频不再打进小程序主包，彻底不占包体积。
// - 每首歌的 video 字段是它专属的视频文件名（1:1 对应，歌名即绑定），
//   你把真实广场舞视频按这些文件名传到云上即可正确匹配。
// ============================================================
const VIDEO_BASE = 'http://127.0.0.1:8081/video/'

// 解析视频完整地址：video 已是绝对地址（http/https）则直接用，否则拼 VIDEO_BASE
function resolveVideo(video: string): string {
  return /^https?:\/\//.test(video) ? video : VIDEO_BASE + video
}

// 推荐视频卡片的封面渐变（无封面图时用渐变占位，更显“视频感”）
const GRADIENTS = [
  'linear-gradient(135deg,#ff9a9e,#fecfef)',
  'linear-gradient(135deg,#a18cd1,#fbc2eb)',
  'linear-gradient(135deg,#ffecd2,#fcb69f)',
  'linear-gradient(135deg,#84fab0,#8fd3f4)',
  'linear-gradient(135deg,#fccb90,#d57eeb)',
  'linear-gradient(135deg,#f093fb,#f5576c)',
  'linear-gradient(135deg,#4facfe,#00f2fe)',
  'linear-gradient(135deg,#43e97b,#38f9d7)',
  'linear-gradient(135deg,#fa709a,#fee140)',
  'linear-gradient(135deg,#30cfd0,#330867)',
  'linear-gradient(135deg,#ff6a00,#ee0979)',
  'linear-gradient(135deg,#642b73,#c6426e)',
]

Component({
  data: {
    keyword: '',
    activeType: '全部',
    types: ['全部', '广场舞', '交谊舞', '民族舞', '健身操', '鬼步舞'],
    songs: [
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
    ] as Song[],
    filtered: [] as Song[],
    recommendList: [] as any[], // 默认落地页的推荐广场舞视频网格
    showVideo: false,
    currentVideo: '',
    currentSong: '',
    currentType: '',
    subTitle: '',
    isScoped: false,
    videoFull: false, // true=满屏播放（推荐视频），false=居中卡片（歌曲）
    rate: 1,
    shaking: {
      rate05: false,
      rate1: false,
    },
    fireworkActive: false,
    showPraise: false,
  },
  methods: {
    onLoad(options: any) {
      // 从首页带舞种参数跳进来：?type=广场舞
      if (options && options.type) {
        const type = decodeURIComponent(options.type)
        this.setData({
          activeType: type,
          subTitle: type,
          isScoped: true,
        })

        // 从搜索结果页跳过来，直接打开视频
        if (options.video) {
          const video = decodeURIComponent(options.video)
          const song = options.song ? decodeURIComponent(options.song) : ''
          this.setData({
            currentVideo: video,
            currentSong: song,
            currentType: type,
            videoFull: false,
            showVideo: true,
            rate: 1,
          })
        }
      }
      this.applyFilter()

      // 默认落地页（未搜索、未带舞种）：填充广场舞视频网格
      const rec = this.data.songs
        .filter((s) => s.type === '广场舞')
        .map((s, i) => ({ ...s, cover: GRADIENTS[i % GRADIENTS.length] }))
      this.setData({ recommendList: rec })
    },
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
      const name = e.currentTarget.dataset.name as string
      const song = this.data.songs.find((s) => s.name === name)
      if (!song) return
      this.setData({
        currentVideo: resolveVideo(song.video),
        currentSong: song.name,
        currentType: song.type,
        videoFull: false,
        showVideo: true,
        rate: 1,
        fireworkActive: false,
        showPraise: false,
      })
      this.data._fireReady = false
    },

    // 点击推荐视频卡片 → 居中卡片播放（可预览，也可“去跳舞”）
    onRecTap(e: any) {
      const name = e.currentTarget.dataset.name as string
      const song = this.data.recommendList.find((s) => s.name === name)
      if (!song) return
      this.setData({
        currentVideo: resolveVideo(song.video),
        currentSong: song.name,
        currentType: song.type,
        videoFull: false,
        showVideo: true,
        rate: 1,
        fireworkActive: false,
        showPraise: false,
      })
      this.data._fireReady = false
    },

    // 去跳舞：带当前视频跳转姿态识别页（主体播视频，右下角摄像头识别）
    onGoDance() {
      if (!this.data.currentVideo) return
      wx.navigateTo({
        url: `../pose/pose?video=${encodeURIComponent(this.data.currentVideo)}&song=${encodeURIComponent(this.data.currentSong)}`,
      })
    },

    // 关闭视频
    onCloseVideo() {
      this.stopFirework()
      this.setData({ showVideo: false, currentVideo: '', currentSong: '', currentType: '', videoFull: false, rate: 1, fireworkActive: false, showPraise: false })
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
      const keyMap: Record<number, string> = { 0.5: 'rate05', 1: 'rate1' }
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
