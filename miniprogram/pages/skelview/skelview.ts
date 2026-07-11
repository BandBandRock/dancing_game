// pages/skelview/skelview.ts 骨骼回放 demo
// 在原始跳舞视频之上叠加当帧骨骼动画，直观查看识别效果。
// 骨骼数据来自历史记录里的 skeleton（cloud:// fileID），格式：
//   [{ t: 秒, kp: [[x,y,c]×17] }]，x/y 为 VisionKit 归一化 0~1 坐标。
import { resolveCloudFile } from '../../utils/cloudMedia'

// 与 pose 页一致的骨架连线（COCO-17 核心部分）
const SKELETON: [number, number][] = [
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [11, 12], [5, 11], [6, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [0, 5], [0, 6],
]
const POINT_COLOR = '#5DCAA5'
const LINE_COLOR = '#FFD43B'
const SCORE_THRESHOLD = 0.3

interface Frame { t: number; kp: number[][] }

Component({
  data: {
    playUrl: '',
    teachUrl: '',         // 教学/示例视频（左半屏）
    hasTeach: false,      // 是否存在示例视频（决定双屏还是单屏）
    song: '',
    mirror: false,        // 镜像翻转（前摄录制/预览不一致时用来对齐）
    skeletonReady: false, // 骨骼 JSON 是否解析就绪
    errorMessage: '',     // 调试提示（无骨骼 / 解析失败等）
    statusText: '加载中…',
    debugText: '',        // 调试信息：原视频分辨率 / 骨骼帧数 / 播放进度等
    // ---- 内部状态：直接读写、不触发渲染 ----
    _frames: [] as Frame[],
    _idx: 0,              // 当前骨骼帧指针（随播放时间前进）
    _videoTime: 0,        // 当前视频播放位置(秒)
    _canvas: null as any,
    _ctx: null as any,
    _cw: 0,
    _ch: 0,
    _rafId: 0,
    // 视频原始尺寸与「等比缩放」后的实际显示矩形（object-fit: contain 的 letterbox 区域）
    _videoW: 0,
    _videoH: 0,
    _boxX: 0, // 显示矩形左上角 x（px，相对全屏）
    _boxY: 0,
    _boxW: 0, // 显示矩形宽高（px，保持视频原始比例）
    _boxH: 0,
    _framesLen: 0,       // 骨骼帧总数（调试展示用）
  },

  methods: {
    onLoad(options: any) {
      const video = options && options.video ? decodeURIComponent(options.video) : ''
      const skeleton = options && options.skeleton ? decodeURIComponent(options.skeleton) : ''
      const teach = options && options.teach ? decodeURIComponent(options.teach) : ''
      const song = options && options.song ? decodeURIComponent(options.song) : ''
      this.setData({ song })

      // 教学/示例视频（左半屏）：有则解析播放，无则单屏只放用户视频
      if (teach) {
        resolveCloudFile(teach)
          .then((url) => this.setData({ teachUrl: url, hasTeach: true }))
          .catch(() => this.setData({ hasTeach: false }))
      }

      if (!video) {
        this.setData({ statusText: '缺少视频 fileId', errorMessage: '缺少视频 fileId' })
        return
      }
      // 视频：cloud:// fileID 解析成临时 https 再播放
      resolveCloudFile(video)
        .then((url) => this.setData({ playUrl: url }))
        .catch((e) => this.setData({ statusText: '视频解析失败', errorMessage: '视频解析失败: ' + e }))

      if (!skeleton) {
        this.setData({ statusText: '该记录无骨骼数据', errorMessage: '该记录没有骨骼数据（无法叠加骨骼）' })
        return
      }
      // 骨骼：解析 fileID → 下载 JSON → 就绪后初始化 canvas
      resolveCloudFile(skeleton)
        .then((url) => {
          wx.request({
            url,
            dataType: 'json',
            success: (res: any) => {
              if (!Array.isArray(res.data) || !res.data.length) {
                this.setData({ errorMessage: '骨骼数据为空或格式异常' })
                return
              }
              this.data._frames = res.data as Frame[]
              this.data._framesLen = res.data.length
              this.setData({ skeletonReady: true, statusText: '识别中' })
              this.refreshDebug()
              this.initCanvas()
            },
            fail: (e: any) => {
              console.error('[skelview] 骨骼下载失败', e)
              this.setData({ errorMessage: '骨骼下载失败' })
            },
          })
        })
        .catch((e) => {
          console.error('[skelview] 骨骼解析失败', e)
          this.setData({ errorMessage: '骨骼解析失败: ' + e })
        })
    },

    // 初始化 2D Canvas（Skyline）
    initCanvas(): Promise<void> {
      return new Promise((resolve) => {
        const query = this.createSelectorQuery()
        query.select('#skel')
          .fields({ node: true, size: true })
          .exec((res: any) => {
            if (!res || !res[0] || !res[0].node) {
              this.setData({ errorMessage: 'Canvas 初始化失败' })
              resolve()
              return
            }
            const canvas = res[0].node
            const ctx = canvas.getContext('2d')
            const dpr = (wx.getWindowInfo ? wx.getWindowInfo().pixelRatio : 0) ||
              wx.getSystemInfoSync().pixelRatio || 1
            canvas.width = res[0].width * dpr
            canvas.height = res[0].height * dpr
            ctx.scale(dpr, dpr)
            this.data._canvas = canvas
            this.data._ctx = ctx
            this.data._cw = res[0].width
            this.data._ch = res[0].height
            this.computeBox() // canvas 就绪后补算等比显示矩形（元数据可能先于 canvas 到达）
            this.startLoop()
            resolve()
          })
      })
    },

    // 渲染循环：按当前视频时间取最近骨骼帧并绘制
    startLoop() {
      const canvas = this.data._canvas
      if (!canvas) return
      const loop = () => {
        this.draw()
        this.data._rafId = canvas.requestAnimationFrame(loop)
      }
      this.data._rafId = canvas.requestAnimationFrame(loop)
    },

    draw() {
      const ctx = this.data._ctx
      if (!ctx) return
      const w = this.data._cw
      const h = this.data._ch
      ctx.clearRect(0, 0, w, h)

      const frames = this.data._frames
      if (!frames || !frames.length) return
      const vt = this.data._videoTime || 0

      // 帧指针随播放时间前进（骨骼按 t 升序），O(1) 推进
      let idx = this.data._idx
      while (idx < frames.length - 1 && frames[idx + 1].t <= vt) idx++
      while (idx > 0 && frames[idx].t > vt) idx--
      this.data._idx = idx
      const frame = frames[idx]
      if (!frame || !frame.kp) return

      const mirror = this.data.mirror
      // 骨骼映射到视频「等比显示矩形」内（保持原始比例，不随全屏拉伸变形）
      const bx = this.data._boxW ? this.data._boxX : 0
      const by = this.data._boxH ? this.data._boxY : 0
      const bw = this.data._boxW || w
      const bh = this.data._boxH || h
      const mapX = (nx: number) => bx + (mirror ? (1 - nx) * bw : nx * bw)
      const mapY = (ny: number) => by + ny * bh

      const kp = frame.kp
      const ok = (i: number) => kp[i] && (kp[i][2] === undefined || kp[i][2] >= SCORE_THRESHOLD)

      // 连线
      ctx.strokeStyle = LINE_COLOR
      ctx.lineWidth = 4
      ctx.lineCap = 'round'
      for (const pair of SKELETON) {
        const a = pair[0], b = pair[1]
        if (a >= kp.length || b >= kp.length) continue
        if (!ok(a) || !ok(b)) continue
        ctx.beginPath()
        ctx.moveTo(mapX(kp[a][0]), mapY(kp[a][1]))
        ctx.lineTo(mapX(kp[b][0]), mapY(kp[b][1]))
        ctx.stroke()
      }
      // 关键点
      ctx.fillStyle = POINT_COLOR
      for (let i = 0; i < kp.length; i++) {
        if (!ok(i)) continue
        ctx.beginPath()
        ctx.arc(mapX(kp[i][0]), mapY(kp[i][1]), 5, 0, Math.PI * 2)
        ctx.fill()
      }
    },

    // 视频元数据就绪：记录真实宽高，随后算出「等比显示矩形」
    onMeta(e: any) {
      const vw0 = e && e.detail && e.detail.width
      const vh0 = e && e.detail && e.detail.height
      if (!vw0 || !vh0) return
      this.data._videoW = vw0
      this.data._videoH = vh0
      this.computeBox()
      this.refreshDebug()
    },

    // 组合调试信息：原视频分辨率 / 骨骼帧数 / 当前播放进度（镜像状态）
    refreshDebug() {
      const parts: string[] = []
      if (this.data._videoW && this.data._videoH) {
        parts.push(`原视频 ${this.data._videoW}×${this.data._videoH}`)
      }
      if (this.data._framesLen) {
        parts.push(`骨骼 ${this.data._framesLen} 帧`)
      }
      if (this.data._videoTime) {
        parts.push(`t=${this.data._videoTime.toFixed(1)}s`)
      }
      if (this.data.mirror) parts.push('镜像')
      const txt = parts.join(' · ')
      if (txt && this.data.debugText !== txt) this.setData({ debugText: txt })
    },

    // 计算用户视频（右半屏）在 object-fit: contain 下的实际显示矩形，
    // 让骨骼（归一化 0~1）等比映射到该矩形，与未被拉伸的视频画面精准贴合。
    // 计算基于 canvas 自身尺寸（即右半屏区域），与全屏无关。
    computeBox() {
      const vw0 = this.data._videoW
      const vh0 = this.data._videoH
      const cw = this.data._cw
      const ch = this.data._ch
      if (!vw0 || !vh0 || !cw || !ch) return
      const vr = vw0 / vh0
      const sr = cw / ch
      let boxW: number, boxH: number
      if (vr > sr) { boxW = cw; boxH = cw / vr } else { boxH = ch; boxW = ch * vr }
      this.data._boxX = (cw - boxW) / 2
      this.data._boxY = (ch - boxH) / 2
      this.data._boxW = boxW
      this.data._boxH = boxH
    },

    // 视频播放进度（约 4fps 回调，渲染循环据此选择骨骼帧）
    onTimeUpdate(e: any) {
      if (e && e.detail && typeof e.detail.currentTime === 'number') {
        this.data._videoTime = e.detail.currentTime
        this.refreshDebug()
      }
    },

    // 镜像翻转：前摄录制与预览左右不一致时，用来让骨骼贴合画面
    toggleMirror() {
      this.setData({ mirror: !this.data.mirror })
    },

    // 退出，回到历史页
    onExit() {
      const pages = getCurrentPages()
      if (pages.length > 1) wx.navigateBack()
      else wx.reLaunch({ url: '/pages/history/history' })
    },

    noop() {},
  },
})
