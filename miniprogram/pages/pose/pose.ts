// pages/pose/pose.ts
// VisionKit 人体姿态实时骨骼渲染
// VKSession / VKBodyAnchor 等类型见 typings/vk.d.ts

// ---- 骨架连线（基于 VisionKit 23 点中稳定的 COCO-17 核心部分）----
// 索引含义：0 鼻 1 左眼 2 右眼 3 左耳 4 右耳 5 左肩 6 右肩
// 7 左肘 8 右肘 9 左腕 10 右腕 11 左髋 12 右髋
// 13 左膝 14 右膝 15 左踝 16 右踝
const SKELETON: [number, number][] = [
  [5, 6],           // 双肩
  [5, 7], [7, 9],   // 左臂
  [6, 8], [8, 10],  // 右臂
  [11, 12],         // 双髋
  [5, 11], [6, 12], // 躯干
  [11, 13], [13, 15], // 左腿
  [12, 14], [14, 16], // 右腿
  [0, 5], [0, 6],   // 头到肩
]

const POINT_COLOR = '#5DCAA5'
const LINE_COLOR = '#FFD43B'
const BOX_COLOR = '#FF3B30'   // 官方同款人体检测红框
const SCORE_THRESHOLD = 0.3

Component({
  data: {
    cameraReady: false,
    danceVideo: '',   // 主体教学视频地址（从搜索页「去跳舞」带入）
    songName: '',     // 教学视频名称
    supported: true,
    unsupportedReason: '',
    statusText: '正在初始化…',
    mirror: false,    // 前置预览已被系统镜像，骨骼不再翻转即与画面一致
    fps: 0,
    bodyCount: 0,     // 当前检测到的人体数量（调试用）

    // ---- 算分 ----
    score: 60,        // 当前得分（0~100），初始 60，进度条展示
    moving: false,    // 最近一次判定是否「在动」（手臂-躯干角度>阈值）
    rate: 1,          // 视频播放倍速
    shaking: {         // 倍速按钮颤动状态
      s05: false, s1: false,
    },
    fireworkActive: false,
    showPraise: false,
    // ---- 内部状态：直接读写、不触发渲染（官方 demo 同款做法）----
    _session: null as VKSession | null,
    _canvas: null as any,
    _ctx: null as any,
    _cw: 0,
    _ch: 0,
    _anchors: [] as VKBodyAnchor[],
    _rafId: 0,
    _lastFpsTs: 0,
    _frameCount: 0,
    _lastCount: -1,   // 上一帧人体数量，用于节流 setData
    _loggedFirst: false, // 是否已打印首帧调试信息
    _detecting: false,   // detectBody 是否在处理中（流控）
    _frameListener: null as any, // onCameraFrame 监听器
    _frameW: 0,          // 最近一帧原始宽
    _frameH: 0,          // 最近一帧原始高
    _scoreTimer: 0,      // 每 2 秒判定一次的计时器
  },

  lifetimes: {
    attached() {
      this.checkAndInit()
    },
    detached() {
      this.cleanup()
    },
  },

  methods: {
    // 接收搜索页带入的教学视频
    onLoad(options: any) {
      if (options && options.video) {
        this.setData({
          danceVideo: decodeURIComponent(options.video),
          songName: options.song ? decodeURIComponent(options.song) : '',
          rate: 1,
        })
      }
    },

    // 1) 能力检测 + 初始化
    checkAndInit() {
      if (!(wx as any).createVKSession) {
        this.fallback('当前微信版本过低，请升级微信后重试')
        return
      }

      wx.getSetting({
        success: (res) => {
          if (res.authSetting['scope.camera'] === false) {
            wx.showModal({
              title: '需要摄像头权限',
              content: '请在设置中开启摄像头权限以使用姿态识别',
              confirmText: '去设置',
              success: (r) => { if (r.confirm) wx.openSetting({}) },
            })
            this.fallback('未授权摄像头')
            return
          }
          this.setData({ cameraReady: true }, () => {
            this.initCanvas().then(() => this.initVK())
          })
        },
        fail: () => {
          this.setData({ cameraReady: true }, () => {
            this.initCanvas().then(() => this.initVK())
          })
        },
      })
    },

    // 2) 初始化 Canvas 2D
    initCanvas(): Promise<void> {
      return new Promise((resolve) => {
        const query = this.createSelectorQuery()
        query.select('#skeleton')
          .fields({ node: true, size: true })
          .exec((res) => {
            if (!res || !res[0] || !res[0].node) {
              this.fallback('Canvas 初始化失败')
              resolve()
              return
            }
            const canvas = res[0].node
            const ctx = canvas.getContext('2d')
            const dpr = wx.getSystemInfoSync().pixelRatio || 1
            canvas.width = res[0].width * dpr
            canvas.height = res[0].height * dpr
            ctx.scale(dpr, dpr)

            this.data._canvas = canvas
            this.data._ctx = ctx
            this.data._cw = res[0].width
            this.data._ch = res[0].height
            resolve()
          })
      })
    },

    // 3) 初始化 VisionKit body 会话（mode:2 手动送帧）
    //    关键：camera 组件负责显示画面，onCameraFrame 抽帧 -> session.detectBody 送检
    //    这样避开 mode:1 需要自己用 WebGL 画摄像头画面的复杂度
    initVK() {
      let session: VKSession
      try {
        session = (wx as any).createVKSession({
          track: { body: { mode: 2 } }, // mode:2 手动传入图像
        })
      } catch (e) {
        this.fallback('当前设备不支持人体姿态识别')
        return
      }
      this.data._session = session

      session.on('updateAnchors', (anchors) => {
        this.data._anchors = anchors || []
        this.data._detecting = false
        if (!this.data._loggedFirst && this.data._anchors.length) {
          this.data._loggedFirst = true
          console.log('[VK] first anchor:', JSON.stringify(this.data._anchors[0]))
        }
      })
      session.on('removeAnchors', () => {
        this.data._anchors = []
        this.data._detecting = false
      })

      session.start((errno) => {
        if (errno) {
          console.error('[VK] start failed', errno)
          this.fallback('姿态识别启动失败（errno: ' + errno + '）')
          return
        }
        console.log('[VK] session started, version:', (session as any).version)
        this.setData({ statusText: '识别中，请站到画面中' })
        this.startFrameFeed()   // 开始抽帧送检
        this.startRenderLoop()  // 开始画骨骼
        this.startScoring()     // 开始每 2 秒算分
      })
    },

    // 3.5) 抽取 camera 帧，手动送入 detectBody
    startFrameFeed() {
      const ctx = (wx as any).createCameraContext()
      const listener = ctx.onCameraFrame((frame: any) => {
        // 流控：上一帧还没检测完就跳过，避免堆积
        if (this.data._detecting) return
        const session = this.data._session
        if (!session) return
        this.data._detecting = true
        // 记录最近一帧的原始尺寸，供坐标映射用
        this.data._frameW = frame.width
        this.data._frameH = frame.height
        try {
          session.detectBody({
            frameBuffer: frame.data,
            width: frame.width,
            height: frame.height,
            scoreThreshold: 0.2,
            sourceType: 0, // 0 表示来自视频连续帧
          })
        } catch (e) {
          this.data._detecting = false
          console.error('[VK] detectBody error', e)
        }
      })
      listener.start()
      this.data._frameListener = listener
    },

    // 4) 渲染循环（用 canvas 节点的 requestAnimationFrame，与刷新率同步）
    startRenderLoop() {
      const canvas = this.data._canvas
      const loop = () => {
        this.draw()
        this.tickFps()
        this.data._rafId = canvas.requestAnimationFrame(loop)
      }
      this.data._rafId = canvas.requestAnimationFrame(loop)
    },

    // 5) 绘制骨骼
    draw() {
      const ctx = this.data._ctx
      if (!ctx) return
      const w = this.data._cw
      const h = this.data._ch
      ctx.clearRect(0, 0, w, h)

      const anchors = this.data._anchors
      // 调试：把当前检测到的人数同步到 HUD（节流，避免每帧 setData）
      if (anchors.length !== this.data._lastCount) {
        this.data._lastCount = anchors.length
        this.setData({ bodyCount: anchors.length })
      }
      if (!anchors.length) return

      const mirror = this.data.mirror

      // ---- aspect-fill 坐标校正 ----
      // detectBody 返回的是相对「送检帧」的 0~1 归一化坐标，
      // 而 camera 组件在屏幕上以 aspect-fill(cover) 填充，宽高比通常和帧不同，
      // 直接 x*w,y*h 会拉伸。这里按 cover 规则缩放并居中裁剪校正。
      const fw = this.data._frameW || w
      const fh = this.data._frameH || h
      const scale = Math.max(w / fw, h / fh)
      const dispW = fw * scale
      const dispH = fh * scale
      const offX = (w - dispW) / 2
      const offY = (h - dispH) / 2
      const mapX = (nx: number) => {
        const px = offX + nx * dispW
        return mirror ? (w - px) : px
      }
      const mapY = (ny: number) => offY + ny * dispH

      for (const anchor of anchors) {
        // ---- 官方同款：人体检测红框（origin=左上角, size=宽高，均为 0~1 归一化）----
        if (anchor.origin && anchor.size) {
          const bx = anchor.origin.x
          const by = anchor.origin.y
          const bw = anchor.size.width
          const bh = anchor.size.height
          // 用统一的 mapX/mapY 映射两个对角点，再取外接矩形（自动处理镜像与缩放）
          const x1 = mapX(bx)
          const x2 = mapX(bx + bw)
          const y1 = mapY(by)
          const y2 = mapY(by + bh)
          ctx.strokeStyle = BOX_COLOR
          ctx.lineWidth = 3
          ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
        }

        const pts = anchor.points
        if (!pts || !pts.length) continue
        const conf = anchor.confidence || []

        const ok = (i: number) =>
          !!pts[i] && (conf[i] === undefined || conf[i] >= SCORE_THRESHOLD)

        // 连线
        ctx.strokeStyle = LINE_COLOR
        ctx.lineWidth = 4
        ctx.lineCap = 'round'
        for (const pair of SKELETON) {
          const a = pair[0]
          const b = pair[1]
          if (a >= pts.length || b >= pts.length) continue
          if (!ok(a) || !ok(b)) continue
          ctx.beginPath()
          ctx.moveTo(mapX(pts[a].x), mapY(pts[a].y))
          ctx.lineTo(mapX(pts[b].x), mapY(pts[b].y))
          ctx.stroke()
        }

        // 关键点
        ctx.fillStyle = POINT_COLOR
        for (let i = 0; i < pts.length; i++) {
          if (!ok(i)) continue
          ctx.beginPath()
          ctx.arc(mapX(pts[i].x), mapY(pts[i].y), 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    },

    // 6) FPS 统计
    tickFps() {
      const now = Date.now()
      this.data._frameCount++
      if (!this.data._lastFpsTs) this.data._lastFpsTs = now
      const elapsed = now - this.data._lastFpsTs
      if (elapsed >= 1000) {
        const fps = Math.round((this.data._frameCount * 1000) / elapsed)
        this.setData({ fps })
        this.data._frameCount = 0
        this.data._lastFpsTs = now
      }
    },

    toggleMirror() {
      this.setData({ mirror: !this.data.mirror })
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
      query.select('#fireCanvas')
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
            x: cx + (Math.random() - 0.5) * 60,
            y: cy + (Math.random() - 0.5) * 50,
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

    // 切换视频播放倍速
    setRate(e: any) {
      const rate = Number(e.currentTarget.dataset.rate)
      if (rate === this.data.rate) return

      const keyMap: Record<number, string> = { 0.5: 's05', 1: 's1' }
      const key = keyMap[rate]
      if (key) {
        this.setData({ [`shaking.${key}`]: true })
        setTimeout(() => {
          this.setData({ [`shaking.${key}`]: false })
        }, 350)
      }

      this.setData({ rate }, () => {
        const videoCtx = wx.createVideoContext('poseVideo', this)
        console.log('[pose setRate] rate:', rate, 'videoCtx:', !!videoCtx)
        videoCtx.playbackRate(rate)
      })
    },

    // ---- 算分：每 2 秒判定一次 ----
    // 规则：画面里有人且「在动」（手臂与躯干夹角 > 60°）→ 加分，否则扣分。
    startScoring() {
      if (this.data._scoreTimer) return
      this.data._scoreTimer = setInterval(() => {
        this.evaluateScore()
      }, 2000) as unknown as number
    },

    evaluateScore() {
      const anchors = this.data._anchors
      let delta = -5          // 默认扣分（没人 / 站着不动）
      let moving = false

      if (anchors && anchors.length) {
        let maxAngle = -1
        for (const a of anchors) {
          const ang = this.armTorsoAngle(a)
          if (ang > maxAngle) maxAngle = ang
        }
        if (maxAngle >= 60) {
          delta = 5
          moving = true
        }
      }

      let score = this.data.score + delta
      if (score > 100) score = 100
      if (score < 0) score = 0
      this.setData({ score, moving })
    },

    // 计算某个人体「手臂-躯干」最大夹角（度）。以肩为顶点，
    // 分别用肩→肘、肩→腕 对 肩→髋 求角，左右四组取最大；无有效点返回 -1。
    armTorsoAngle(anchor: VKBodyAnchor): number {
      const pts = anchor.points
      const conf = anchor.confidence || []
      if (!pts || !pts.length) return -1
      const ok = (i: number) =>
        !!pts[i] && (conf[i] === undefined || conf[i] >= SCORE_THRESHOLD)

      // 以 vertex 为顶点，求 vertex→a 与 vertex→b 两向量的夹角
      const angle = (vertex: number, a: number, b: number): number => {
        if (!ok(vertex) || !ok(a) || !ok(b)) return -1
        const v1x = pts[a].x - pts[vertex].x
        const v1y = pts[a].y - pts[vertex].y
        const v2x = pts[b].x - pts[vertex].x
        const v2y = pts[b].y - pts[vertex].y
        const m1 = Math.hypot(v1x, v1y)
        const m2 = Math.hypot(v2x, v2y)
        if (m1 === 0 || m2 === 0) return -1
        let cos = (v1x * v2x + v1y * v2y) / (m1 * m2)
        cos = Math.max(-1, Math.min(1, cos))
        return (Math.acos(cos) * 180) / Math.PI
      }

      // 左臂：肩5 顶点，肘7/腕9 对 髋11；右臂：肩6 顶点，肘8/腕10 对 髋12
      return Math.max(
        angle(5, 7, 11),
        angle(5, 9, 11),
        angle(6, 8, 12),
        angle(6, 10, 12),
      )
    },

    // 返回：优先返回上一页，无栈时回首页
    goBack() {
      const pages = getCurrentPages()
      if (pages.length > 1) {
        wx.navigateBack()
      } else {
        wx.reLaunch({ url: '../home/home' })
      }
    },

    onCameraError(e: any) {
      console.error('[camera] error', e.detail)
      this.fallback('摄像头启动失败')
    },

    fallback(reason: string) {
      this.setData({
        supported: false,
        unsupportedReason: reason,
        statusText: '不可用',
      })
    },

    cleanup() {
      const canvas = this.data._canvas
      if (this.data._rafId && canvas) {
        canvas.cancelAnimationFrame(this.data._rafId)
      }
      if (this.data._scoreTimer) {
        clearInterval(this.data._scoreTimer)
        this.data._scoreTimer = 0
      }
      const listener = this.data._frameListener
      if (listener) {
        try { listener.stop() } catch (e) {}
        this.data._frameListener = null
      }
      const session = this.data._session
      if (session) {
        try { session.stop() } catch (e) {}
        try { session.destroy() } catch (e) {}
        this.data._session = null
      }
    },
  },
})
