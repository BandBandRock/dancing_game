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
    song: '',
    mirror: false,        // 镜像翻转（前摄录制/预览不一致时用来对齐）
    skeletonReady: false, // 骨骼 JSON 是否解析就绪
    errorMessage: '',     // 调试提示（无骨骼 / 解析失败等）
    statusText: '加载中…',
    // ---- 内部状态：直接读写、不触发渲染 ----
    _frames: [] as Frame[],
    _idx: 0,              // 当前骨骼帧指针（随播放时间前进）
    _videoTime: 0,        // 当前视频播放位置(秒)
    _canvas: null as any,
    _ctx: null as any,
    _cw: 0,
    _ch: 0,
    _rafId: 0,
  },

  methods: {
    onLoad(options: any) {
      const video = options && options.video ? decodeURIComponent(options.video) : ''
      const skeleton = options && options.skeleton ? decodeURIComponent(options.skeleton) : ''
      const song = options && options.song ? decodeURIComponent(options.song) : ''
      this.setData({ song })

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
              this.setData({ skeletonReady: true, statusText: '识别中' })
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
      const mapX = (nx: number) => (mirror ? (1 - nx) * w : nx * w)
      const mapY = (ny: number) => ny * h

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

    // 视频播放进度（约 4fps 回调，渲染循环据此选择骨骼帧）
    onTimeUpdate(e: any) {
      if (e && e.detail && typeof e.detail.currentTime === 'number') {
        this.data._videoTime = e.detail.currentTime
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
