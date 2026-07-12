// pages/pose/pose.ts
// VisionKit 人体姿态实时骨骼渲染
// VKSession / VKBodyAnchor 等类型见 typings/vk.d.ts

import { uploadVideo } from '../../utils/cosUpload'
import { resolveCloudFile } from '../../utils/cloudMedia'
import { IAppOption, AlignConfig } from '../../app'

const app = getApp<IAppOption>()

// 对齐阶段配置：优先取 globalData.align（真机可不重编译调整），缺省用兜底值
const DEFAULT_ALIGN: AlignConfig = {
  hold: 3000,        // 需站定时长(ms)
  boxMargin: 0.25,   // 躯干目标框边距（占屏比例）→ 框=0.5屏居中
  minTorso: 0.15,    // 躯干最小占屏高（站太远下限）
  maxTorso: 0.42,    // 躯干最大占屏高（站太近上限）
}
function alignCfg(): AlignConfig {
  const g = app && app.globalData && app.globalData.align
  return g ? { ...DEFAULT_ALIGN, ...g } : DEFAULT_ALIGN
}


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

// ===== 可调参数（调试打分效果用，方便微调）=====
const TOL = 0.6               // 规范空间容差：关节距离 > TOL 个「肩距」则该关节相似度归零
const SAMPLE_INTERVAL = 200   // 打分采样间隔(ms)：每 200ms 比对一次参考帧
const FLIP_REF = true         // 示范视频是否镜像：自拍预览被系统镜像，默认翻转参考以对齐左右
const EMA_ALPHA = 0.3         // 分数平滑：瞬时分权重 0.3，历史分权重 0.7
const SKIP_WARN_FRAMES = 15   // 连续跳过(多人/缺帧)达 15 次(≈3s) → 触发红色告警
const SKIP_TAIL = 5           // 抖音教学视频末尾广告语时长(秒)：播放到此处即结束，跳过广告

// 对齐阶段参数已迁移至 globalData.align（见 app.ts），由 alignCfg() 读取

// 参与打分的关节（COCO-17 索引），以四肢为主、脸(0~4)忽略
const SCORED_JOINTS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
// 各关节权重：手臂(肘/腕)动作最明显给高权重
const JOINT_WEIGHT: Record<number, number> = {
  7: 1.5, 8: 1.5, 9: 1.5, 10: 1.5,   // 左/右 肘、腕
  13: 1.2, 14: 1.2, 15: 1.2, 16: 1.2, // 左/右 膝、踝
}

interface KP { x: number; y: number; c: number }
type Canon = ({ x: number; y: number } | null)[]

// 把 COCO-17 关键点归一化到「双髋中点为原点、双肩距为尺度」的规范空间（y 向下，与两边一致）
// 这样无论参考是像素坐标、用户是 0~1，还是两人离镜头远近不同，都能直接比较。
function canonicalize(kps: KP[]): Canon {
  const out: Canon = new Array(17).fill(null)
  if (!kps || kps.length < 17) return out
  const h11 = kps[11], h12 = kps[12], s5 = kps[5], s6 = kps[6]
  if (!h11 || !h12 || !s5 || !s6) return out
  const cx = (h11.x + h12.x) / 2
  const cy = (h11.y + h12.y) / 2
  const scale = Math.hypot(s5.x - s6.x, s5.y - s6.y) || 1
  for (let i = 0; i < 17; i++) {
    const k = kps[i]
    if (!k || k.c < SCORE_THRESHOLD) { out[i] = null; continue }
    out[i] = { x: (k.x - cx) / scale, y: (k.y - cy) / scale }
  }
  return out
}

// 参考与用户规范骨架的逐关节相似度 → 0~1
function frameSimilarity(ref: Canon, usr: Canon): number {
  let sum = 0, wsum = 0
  for (const i of SCORED_JOINTS) {
    const r = ref[i], u = usr[i]
    if (!r || !u) continue
    const d = Math.hypot(r.x - u.x, r.y - u.y)
    const sim = Math.max(0, 1 - d / TOL)
    const w = JOINT_WEIGHT[i] || 1
    sum += w * sim
    wsum += w
  }
  return wsum ? sum / wsum : 0
}



Component({
  data: {
    cameraReady: false,
    danceVideo: '',   // 主体教学视频 fileID/地址（从搜索页「去跳舞」带入，原始值）
    playUrl: '',      // 实际给 <video> 播放的地址（cloud:// 会先解析成临时 https）
    songName: '',     // 教学视频名称
    songType: '',     // 舞种（广场舞/交谊舞…，用于退出后跳回该舞种列表）
    supported: true,
    unsupportedReason: '',
    statusText: '正在初始化…',
    mirror: false,    // 前置预览已被系统镜像，骨骼不再翻转即与画面一致
    fps: 0,
    bodyCount: 0,     // 当前检测到的人体数量（调试用）

    // ---- 跳舞会话状态 ----
    started: false,   // 是否已点「开始跳舞」
    ended: false,     // 是否已结束（防止重复保存）
    paused: false,    // 是否暂停中（停一下弹窗）
    startTime: 0,     // 开始跳舞的时间戳（毫秒，用于记录开始时间）

    // ---- 算分 ----
    score: 60,        // 当前得分（0~100），初始 60，进度条展示
    moving: false,    // 最近一次判定是否「在动」（相似度>0.5）
    rate: 0.8,          // 视频播放倍速（默认 0.8x）
    refReady: false,  // 示范骨骼是否已下载并解析就绪
    warn: false,      // 是否处于「连续多人/缺帧」红色告警

    // ---- 对齐阶段（游戏开始前）----
    aligning: true,       // 是否处于「对齐」阶段（全屏摄像头 + 红框，站定后自动开始）
    alignProgress: 0,     // 对齐进度 0~100
    inBox: false,         // 当前单人是否整体落在红框内（用于 UI 反馈）
    alignHint: '把身体中部对准红框',  // 对齐提示文案（居中/太远/太近）
    counting: false,     // 是否处于「3-2-1 倒计时」阶段（对齐达标后、正式开始前）
    countdown: 0,        // 倒计时数字（3/2/1），0 表示不显示
    shaking: {         // 倍速按钮颤动状态
      s05: false, s08: false,
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
    _scoreTimer: 0,      // 打分采样计时器
    _refT: [] as number[],          // 示范骨骼时间轴（秒）
    _refCanon: [] as Canon[],       // 示范骨骼每帧的规范骨架（预计算）
    _userSkel: [] as { t: number; kp: number[][] }[], // 用户跳舞骨骼序列（{t, kp:[[x,y,c]×17]}），结束时上传云端
    _skeletonFileID: '', // 教练骨骼 JSON 的 cloud:// fileID（从 dance_search 传入）
    _prevKp: null as number[][] | null, // 上一帧关键点（简易打分用）
    _videoTime: 0,      // 当前教学视频播放位置(秒)，来自 timeupdate
    _skipCount: 0,      // 连续跳过的采样次数（多人/缺帧）
    _alignTimer: 0,     // 对齐检测计时器
    _alignAccum: 0,     // 已累计在框内时间(ms)
    _alignLast: 0,      // 上一次对齐计时时间戳
    _alignTooFar: false,   // 站太远（躯干过小）
    _alignTooNear: false,  // 站太近（躯干过大）
    _alignHold: 3000,      // 当前对齐所需站定时长(ms)，来自 alignCfg()
    _videoDuration: 0,     // 教学视频总时长(秒)，来自 loadedmetadata
    _countdownTimer: 0,    // 3-2-1 倒计时计时器

    // ---- 录制自己的跳舞视频 ----
    _wantRecord: false,  // 是否已请求录制（点「开始跳舞」后置 true）
    _recording: false,   // 录制是否进行中
    _cameraCtx: null as any, // 摄像头录制上下文（CameraContext）
  },

  lifetimes: {
    attached() {
      // 不再自动启动，等用户点「开始跳舞」
    },
    detached() {
      this.cleanup()
    },
  },

  methods: {
    // 接收搜索页带入的教学视频
    onLoad(options: any) {
      if (options && options.video) {
        const rate = options.rate ? Number(options.rate) : 0.8
        this.setData({
          danceVideo: decodeURIComponent(options.video),
          songName: options.song ? decodeURIComponent(options.song) : '',
          songType: options.type ? decodeURIComponent(options.type) : '',
          rate,
        })
        // 保存教练骨骼 fileID（从 dance_search 传入）
        if (options.skeleton) {
          this.data._skeletonFileID = decodeURIComponent(options.skeleton)
        }
        // 同步设置视频倍速
        setTimeout(() => {
          const vc = wx.createVideoContext('danceVideo', this)
          vc.playbackRate(rate)
        }, 100)
      }
      // 教学视频若是 cloud:// fileID，先解析成临时可播放地址再交给 <video>
      if (this.data.danceVideo) {
        resolveCloudFile(this.data.danceVideo).then((url) => {
          if (url) this.setData({ playUrl: url })
        }).catch((e) => {
          console.error('[pose] 教学视频解析失败', e)
        })
      }
      // 进入即开始对齐：全屏摄像头 + 红框，站定 3 秒自动开始
      this.enterAlign()
    },

    // 进入「对齐」阶段：全屏摄像头、画红框，等待用户站进框内
    enterAlign() {
      this.setData({
        aligning: true,
        alignProgress: 0,
        inBox: false,
        started: false,
        ended: false,
        statusText: '请站到红框内',
      })
      this.data._wantRecord = false
      this.data._alignAccum = 0
      this.data._alignLast = 0
      this.checkAndInit()   // 初始化摄像头 + 识别（对齐阶段只检测、不评分）
    },

    // 真正开始游戏（对齐完成后自动调用，或降级时手动点击兜底）
    beginGame() {
      this.setData({
        aligning: false,
        started: true,
        ended: false,
        startTime: Date.now(),
        score: 60,
        moving: false,
        refReady: false,
        warn: false,
        statusText: '识别中',
      })
      // 重置内部打分状态
      this.data._videoTime = 0
      this.data._skipCount = 0
      this.data._refT = []
      this.data._refCanon = []
      this.data._userSkel = []
      // 下载并解析示范骨骼
      this.loadReference()
      // 标记希望录制，开始录制自己的跳舞视频
      this.data._wantRecord = true
      this.startRecording()
      this.startScoring()
      // 播放教学视频（不循环，播完触发结束）
      if (this.data.danceVideo) {
        const vc = wx.createVideoContext('danceVideo', this)
        setTimeout(() => vc.play(), 50)
      }
    },

    // 点击「开始跳舞」：手动开始（无姿态识别降级时的兜底入口）
    startDance() {
      if (this.data.started || this.data.aligning || this.data.counting) return
      this.startWithCountdown()
    },

    // 对齐达标 / 手动开始 → 摄像头收缩到右下角 + 3-2-1 倒计时，再正式开始
    startWithCountdown() {
      // aligning 已=false（收缩过渡由 CSS 处理），这里只负责倒计时
      this.runCountdown(() => this.beginGame())
    },

    // 3-2-1 倒计时：每 1s 递减，归零后回调正式开始
    runCountdown(cb: () => void) {
      this.setData({ counting: true, statusText: '准备…' })
      let n = 3
      this.setData({ countdown: n })
      this.data._countdownTimer = setInterval(() => {
        n -= 1
        if (n <= 0) {
          clearInterval(this.data._countdownTimer)
          this.data._countdownTimer = 0
          this.setData({ counting: false, countdown: 0 })
          cb()
        } else {
          this.setData({ countdown: n })
        }
      }, 1000) as unknown as number
    },

    // 停一下：暂停视频和打分，弹出选择
    onPause() {
      this.setData({ paused: true })
      try {
        const vc = wx.createVideoContext('danceVideo', this)
        vc.pause()
      } catch (e) {}
      this.stopScoring()
    },

    // 重新开始：关闭弹窗，重头开始跳舞
    onRestart() {
      this.setData({ paused: false })
      // 重置状态，重新开始
      this.setData({ started: false, ended: false, score: 60, moving: false })
      this.data._userSkel = []
      this.data._videoTime = 0
      this.startWithCountdown()
    },

    // 返回：放弃本次跳舞，回到上一页
    onGoBack() {
      this.setData({ paused: false })
      try {
        const vc = wx.createVideoContext('danceVideo', this)
        vc.stop()
      } catch (e) {}
      const pages = getCurrentPages()
      if (pages.length > 1) {
        wx.navigateBack()
      } else {
        wx.reLaunch({ url: '/pages/dance_search/dance_search' })
      }
    },

    // 点击「结束跳舞」或视频播放完毕：上传云端后跳转反馈页（由反馈页保存/分享落盘）
    async finishDance() {
      if (!this.data.started || this.data.ended) return
      this.setData({ ended: true, started: false })

      // 停止识别与算分
      this.stopScoring()
      const vc = wx.createVideoContext('danceVideo', this)
      try { vc.stop() } catch (e) {}

      // 先停录制拿到自己跳舞的视频，再上传云端
      let finalVideo = this.data.danceVideo // 兜底用教学视频
      try {
        const tempPath = await this.stopRecording()
        if (tempPath) {
          // 上传到云存储（云端 fileID 永久有效、跨设备可用），创建者=当前用户自带读权限
          wx.showLoading({ title: '正在计算…', mask: true })
          try {
            const result = await uploadVideo({
              filePath: tempPath,
              fileName: `dance_${Date.now()}.mp4`,
              timeoutMs: 300000, // 跳舞视频较长，给 5 分钟
            })
            finalVideo = result.fileID
            console.log('[pose] 跳舞视频已上传云端:', result.fileID)
          } catch (e) {
            console.error('[pose] 云端上传失败，兜底存本地', e)
            // 上传失败：本地持久化兜底（仅本机可用）
            const local = await this.persistVideo(tempPath)
            finalVideo = local || this.data.danceVideo
          }
          wx.hideLoading()
        }
      } catch (e) {
        wx.hideLoading()
      }

      // 上传用户跳舞骨骼序列 JSON（与视频解耦，单独可回放/复盘）
      let skeletonFileID = ''
      try {
        if (this.data._userSkel.length) {
          const fs = wx.getFileSystemManager()
          const jsonPath = `${wx.env.USER_DATA_PATH}/dance_${Date.now()}_skel.json`
          fs.writeFileSync(jsonPath, JSON.stringify(this.data._userSkel))
          wx.showLoading({ title: '正在计算…', mask: true })
          const skelRes = await uploadVideo({
            filePath: jsonPath,
            fileName: `dance_${Date.now()}_skeleton.json`,
            timeoutMs: 120000, // 骨骼 JSON 较小，2 分钟足够
          })
          skeletonFileID = skelRes.fileID
          console.log('[pose] 用户骨骼已上传云端:', skeletonFileID, '共', this.data._userSkel.length, '帧')
          wx.hideLoading()
        }
      } catch (e) {
        console.error('[pose] 骨骼上传失败（不影响视频）', e)
        wx.hideLoading()
      }


      const start = new Date(this.data.startTime)
      const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
      const dateStr =
        start.getFullYear() + '-' + pad(start.getMonth() + 1) + '-' + pad(start.getDate())
      const pending: any = {
        song: this.data.songName || '未命名舞蹈',
        type: this.data.songType || '',
        score: this.data.score,
        date: dateStr,
        hour: start.getHours(),
        minute: start.getMinutes(),
        video: finalVideo,
        teach: this.data.danceVideo, // 教学视频，供「重跳」复用
        skeleton: skeletonFileID || undefined,
        rate: this.data.rate, // 教学视频倍速，回放时需同步
      }

      // 跳转反馈页（保存/分享由反馈页落盘到历史）
      wx.hideLoading()
      wx.setStorageSync('__pendingDance', pending)
      wx.redirectTo({ url: '../feedback/feedback' })
    },

    // 开始录制摄像头（自己跳舞的视频）。摄像头就绪后调用。
    startRecording() {
      if (this.data._recording || !this.data.cameraReady) return
      if (!this.data._wantRecord) return
      const ctx = this.ensureCameraContext()
      // 等摄像头组件真正渲染就绪再开始录制，避免时序问题
      setTimeout(() => {
        if (this.data._recording) return
        ctx.startRecord({
          timeoutCallback: () => {
            // 达到录制时长上限，自动结束本次跳舞
            if (this.data.started && !this.data.ended) this.finishDance()
          },
          success: () => {
            this.data._recording = true
          },
          fail: (e: any) => {
            console.error('[record] start failed', e)
            this.data._recording = false
            this.data._cameraCtx = null
          },
        })
      }, 300)
    },

    // 停止录制，返回临时视频路径（未录制则返回空串）
    stopRecording(): Promise<string> {
      return new Promise((resolve) => {
        const ctx = this.data._cameraCtx
        if (!this.data._recording || !ctx) {
          resolve('')
          return
        }
        this.data._recording = false
        ctx.stopRecord({
          success: (res: any) => {
            resolve(res.tempVideoPath || '')
          },
          fail: (e: any) => {
            console.error('[record] stop failed', e)
            resolve('')
          },
        })
      })
    },

    // 把临时视频转存到本地持久目录，避免被微信临时文件清理机制删除
    persistVideo(tempPath: string): Promise<string> {
      return new Promise((resolve) => {
        if (!tempPath) {
          resolve('')
          return
        }
        const fs = wx.getFileSystemManager()
        fs.saveFile({
          tempFilePath: tempPath,
          success: (res: any) => resolve(res.savedFilePath || tempPath),
          fail: (e: any) => {
            console.error('[saveFile] fail', e)
            resolve(tempPath) // 持久化失败则用临时路径兜底
          },
        })
      })
    },

    // 视频播放结束 → 礼花 + 你真棒，然后自动结束跳舞保存记录
    onVideoEnded() {
      // 先展示礼花与"你真棒"
      this.setData({ fireworkActive: true, showPraise: true })
      setTimeout(() => this.prepFireCanvas(), 100)
      // 延迟结束后自动保存跳舞记录
      setTimeout(() => {
        if (this.data.started && !this.data.ended) {
          this.finishDance()
        }
      }, 1500)
    },

    // 停止算分计时器
    stopScoring() {
      if (this.data._scoreTimer) {
        clearInterval(this.data._scoreTimer)
        this.data._scoreTimer = 0
      }
    },

    // 1) 能力检测 + 初始化
    checkAndInit() {
      if (!(wx as any).createVKSession) {
        // 没有姿态识别能力：跳过对齐，直接显示「开始跳舞」兜底入口
        this.setData({ cameraReady: true, aligning: false, statusText: '开始录制（无姿态识别）' })
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
        // 对齐阶段先做「站框检测」，否则直接进入算分
        if (this.data.aligning) this.startAligning()
        else this.startScoring()
      })
    },

    // 3.5) 抽取 camera 帧，手动送入 detectBody
    //    与录制共用同一个 CameraContext（避免多实例冲突）
    ensureCameraContext(): any {
      if (!this.data._cameraCtx) {
        this.data._cameraCtx = (wx as any).createCameraContext()
      }
      return this.data._cameraCtx
    },

    startFrameFeed() {
      const ctx = this.ensureCameraContext()
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

      // 对齐阶段：画红框（在框内变绿），与 torsoAligned 同一坐标系
      if (this.data.aligning) {
        const m = alignCfg().boxMargin
        const rx = m * w
        const ry = m * h
        const rw = (1 - 2 * m) * w
        const rh = (1 - 2 * m) * h
        ctx.save()
        ctx.strokeStyle = this.data.inBox ? '#34C759' : '#FF3B30'
        ctx.lineWidth = 6
        ctx.setLineDash([20, 14])
        ctx.strokeRect(rx, ry, rw, rh)
        ctx.setLineDash([])
        ctx.restore()
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

      const keyMap: Record<number, string> = { 0.5: 's05', 0.8: 's08' }
      const key = keyMap[rate]
      if (key) {
        this.setData({ [`shaking.${key}`]: true })
        setTimeout(() => {
          this.setData({ [`shaking.${key}`]: false })
        }, 350)
      }

      this.setData({ rate }, () => {
        const videoCtx = wx.createVideoContext('danceVideo', this)
        console.log('[pose setRate] rate:', rate, 'videoCtx:', !!videoCtx)
        videoCtx.playbackRate(rate)
      })
    },

    // ---- 算分：每 SAMPLE_INTERVAL(ms) 采样一次，与对应时刻的示范骨架比对 ----
    startScoring() {
      if (this.data._scoreTimer) return
      this.data._scoreTimer = setInterval(() => {
        this.sampleScore()
      }, SAMPLE_INTERVAL) as unknown as number
    },

    // ---- 对齐阶段：每 100ms 检测一次「躯干是否居中」，累计 alignCfg().hold 后自动开始 ----
    startAligning() {
      if (this.data._alignTimer) return
      this.data._alignHold = alignCfg().hold
      this.data._alignLast = Date.now()
      this.data._alignTimer = setInterval(() => {
        this.tickAlign()
      }, 100) as unknown as number
    },

    tickAlign() {
      if (!this.data.aligning) return
      const now = Date.now()
      const dt = now - this.data._alignLast
      this.data._alignLast = now

      const inside = this.torsoAligned()
      this.data._inBox = inside
      if (inside) this.data._alignAccum += dt
      else this.data._alignAccum = 0

      // 根据距离状态给出提示（太近/太远优先，否则提示居中）
      let hint = '把身体中部对准红框'
      if (inside) hint = '保持住，马上开始…'
      else if (this.data._alignTooNear) hint = '离太近了，请后退一点'
      else if (this.data._alignTooFar) hint = '离太远了，请靠近一点'

      const p = Math.min(100, Math.round((this.data._alignAccum / this.data._alignHold) * 100))
      if (p !== this.data.alignProgress || inside !== this.data.inBox || hint !== this.data.alignHint) {
        this.setData({ alignProgress: p, inBox: inside, alignHint: hint })
      }

      if (p >= 100) {
        this.stopAligning()
        this.startWithCountdown()   // 站定达标：摄像头收缩 + 3-2-1 倒计时后开始
      }
    },

    stopAligning() {
      if (this.data._alignTimer) {
        clearInterval(this.data._alignTimer)
        this.data._alignTimer = 0
      }
      this.setData({ aligning: false })
    },

    // 判断当前是否为「单人且躯干居中」：只需肩/髋中心落在中央框内，且躯干不太小（不站太远）
    torsoAligned(): boolean {
      // 每次判定先清距离标志，避免多人/关键点缺失时残留旧提示
      this.data._alignTooFar = false
      this.data._alignTooNear = false
      const anchors = this.data._anchors
      if (!anchors || anchors.length !== 1) return false   // 必须单人
      const a = anchors[0]
      const pts = a.points
      const conf = a.confidence || []
      if (!pts || pts.length < 13) return false
      const ok = (i: number) => !!pts[i] && (conf[i] === undefined || conf[i] >= SCORE_THRESHOLD)
      // 需要双肩(5,6)与双髋(11,12)均可见，才能定位躯干
      if (!ok(5) || !ok(6) || !ok(11) || !ok(12)) return false

      const w = this.data._cw, h = this.data._ch
      if (!w || !h) return false
      // 与 draw() 一致的 aspect-fill 坐标校正（含镜像）
      const fw = this.data._frameW || w
      const fh = this.data._frameH || h
      const scale = Math.max(w / fw, h / fh)
      const dispW = fw * scale
      const dispH = fh * scale
      const offX = (w - dispW) / 2
      const offY = (h - dispH) / 2
      const mirror = this.data.mirror
      const mapX = (nx: number) => {
        const px = offX + nx * dispW
        return mirror ? (w - px) : px
      }
      const mapY = (ny: number) => offY + ny * dispH

      // 躯干中心 = 肩中点 与 髋中点 的中点（归一化坐标）
      const sx = (pts[5].x + pts[6].x) / 2, sy = (pts[5].y + pts[6].y) / 2
      const hx = (pts[11].x + pts[12].x) / 2, hy = (pts[11].y + pts[12].y) / 2
      const tx = (sx + hx) / 2, ty = (sy + hy) / 2
      const cx = mapX(tx), cy = mapY(ty)

      // 中央目标框（留 2% 余量）——躯干中心落在此框内即视为对齐
      const cfg = alignCfg()
      const pad = 0.02
      const rx1 = (cfg.boxMargin + pad) * w
      const ry1 = (cfg.boxMargin + pad) * h
      const rx2 = (1 - cfg.boxMargin - pad) * w
      const ry2 = (1 - cfg.boxMargin - pad) * h
      const centered = cx >= rx1 && cx <= rx2 && cy >= ry1 && cy <= ry2

      // 躯干尺寸（肩-髋在屏幕上的垂直距离）：过小=站太远（视频看不清），过大=站太近（四肢易出框）
      const torsoPx = Math.abs(mapY(sy) - mapY(hy))
      const sizeOk = torsoPx >= cfg.minTorso * h && torsoPx <= cfg.maxTorso * h
      // 记录当前距离状态，供 UI 提示「靠近/后退」
      this.data._alignTooFar = torsoPx < cfg.minTorso * h
      this.data._alignTooNear = torsoPx > cfg.maxTorso * h

      return centered && sizeOk
    },

    // 单帧采样：定位参考帧 → 取用户骨骼 → 算相似度 → EMA 平滑成分数
    sampleScore() {
      if (!this.data.started || this.data.ended) return

      const usr = this.currentUserKp()

      // 没检测到人 → 跳过
      if (!usr) {
        this.data._skipCount++
        if (this.data._skipCount >= SKIP_WARN_FRAMES && !this.data.warn) {
          this.setData({ warn: true })
        }
        return
      }

      this.data._skipCount = 0
      if (this.data.warn) this.setData({ warn: false })

      // === 简易算法：只要手脚在动就给分（不依赖教练骨骼） ===
      // 计算四肢关键点（腕+踝）相对上一帧的位移，有动就给高分
      const limbs = [9, 10, 15, 16] // 左腕、右腕、左踝、右踝
      let motion = 0
      const prev = this.data._prevKp as number[][] | null
      if (prev && prev.length === 17) {
        for (const i of limbs) {
          const dx = usr[i].x - prev[i][0]
          const dy = usr[i].y - prev[i][1]
          motion += Math.sqrt(dx * dx + dy * dy)
        }
      }
      // 保存当前帧供下次对比
      this.data._prevKp = usr.map((p) => [p.x, p.y, p.c])

      // motion 归一化：经验值，motion > 0.15 算"在动"
      const moving = motion > 0.05
      const inst = moving ? Math.min(100, 60 + Math.round(motion * 200)) : 40
      const score = Math.round(this.data.score * (1 - EMA_ALPHA) + inst * EMA_ALPHA)
      this.setData({ score, moving })

      // 累积本帧用户骨骼
      this.data._userSkel.push({
        t: this.data._videoTime,
        kp: usr.map((p) => [p.x, p.y, p.c]),
      })

      /* === 原算法（对比教练骨骼打分，暂时保留备用） ===
      if (!this.data.refReady) return
      const ref = this.lookupRef(this.data._videoTime)
      const refUsable = !!ref && ref.some((j, i) => j && SCORED_JOINTS.indexOf(i) >= 0)
      if (!refUsable) return
      const uc = canonicalize(usr)
      const sim = frameSimilarity(ref, uc)
      const inst = Math.round(sim * 100)
      const score = Math.round(this.data.score * (1 - EMA_ALPHA) + inst * EMA_ALPHA)
      this.setData({ score, moving: sim > 0.5 })
      === 原算法结束 === */
    },

    // 下载并解析示范骨骼 JSON（开始跳舞时调用）
    loadReference() {
      // 优先用从 videos 集合传入的 skeletonFileID
      const skelFileID = this.data._skeletonFileID
      if (!skelFileID) {
        console.warn('[pose] 无教练骨骼 fileID，跳过示范骨骼加载（打分将不可用）')
        return
      }
      console.log('[pose] 下载示范骨骼:', skelFileID)

      // 真正发起请求（拿到可访问的 https 地址后）
      const fetchJson = (reqUrl: string) => {
        wx.request({
          url: reqUrl,
          dataType: 'json',
          success: (res: any) => {
            const frames = res.data
            if (!Array.isArray(frames)) {
              console.error('[pose] 示范骨骼格式异常', res)
              return
            }
            const refT: number[] = []
            const refCanon: Canon[] = []
            for (const f of frames) {
              const t = typeof f.t === 'number' ? f.t : (refT.length ? refT[refT.length - 1] + 1 / 30 : 0)
              refT.push(t)
              const kp = f.kp
              if (!kp) { refCanon.push(new Array(17).fill(null)); continue }
              const kps: KP[] = kp.map((p: any) => ({ x: p[0], y: p[1], c: p[2] !== undefined ? p[2] : 1 }))
              const canon = canonicalize(kps)
              if (FLIP_REF) for (const j of canon) if (j) j.x = -j.x
              refCanon.push(canon)
            }
            this.data._refT = refT
            this.data._refCanon = refCanon
            this.data.refReady = true
            console.log('[pose] 示范骨骼就绪，共', refCanon.length, '帧')
          },
          fail: (e: any) => {
            console.error('[pose] 示范骨骼下载失败', e)
          },
        })
      }

      // cloud:// fileID 先解析成临时 https，再 wx.request 下载
      resolveCloudFile(skelFileID).then(fetchJson).catch((e) => {
        console.error('[pose] 示范骨骼解析/下载失败', e)
      })
    },

    // 按播放时间二分查找最近的示范帧（返回该帧规范骨架）
    lookupRef(t: number): Canon | null {
      const T = this.data._refT
      const C = this.data._refCanon
      if (!T.length) return null
      let lo = 0, hi = T.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (T[mid] < t) lo = mid + 1
        else hi = mid
      }
      // lo 为第一个 >= t 的帧，比较 lo 与 lo-1 取时间更近者
      let idx = lo
      if (lo > 0 && Math.abs(T[lo - 1] - t) < Math.abs(T[lo] - t)) idx = lo - 1
      return C[idx] || null
    },

    // 取当前用户骨骼（COCO-17 前 17 点，归一化 0~1）。非单人返回 null → 视为跳过
    currentUserKp(): KP[] | null {
      const anchors = this.data._anchors
      if (!anchors || anchors.length !== 1) return null   // 0 人或多人 → 跳过
      const a = anchors[0]
      const pts = a.points
      const conf = a.confidence || []
      if (!pts || pts.length < 17) return null
      const out: KP[] = []
      for (let i = 0; i < 17; i++) {
        const p = pts[i]
        if (!p) return null
        out.push({ x: p.x, y: p.y, c: conf[i] !== undefined ? conf[i] : 1 })
      }
      return out
    },

    // 教学视频播放进度回调（提供准确的播放位置，自动含倍速影响）
    onTimeUpdate(e: any) {
      if (e && e.detail && typeof e.detail.currentTime === 'number') {
        const t = e.detail.currentTime
        this.data._videoTime = t
        // 跳过抖音视频末尾广告语：播放到「总时长 - SKIP_TAIL」即结束本次跳舞
        const dur = this.data._videoDuration
        if (this.data.started && !this.data.ended && dur > SKIP_TAIL + 1 && t >= dur - SKIP_TAIL) {
          this.finishDance()
        }
      }
    },

    // 教学视频元信息（拿到总时长，用于跳过末尾广告语）
    onVideoMeta(e: any) {
      if (e && e.detail && typeof e.detail.duration === 'number') {
        this.data._videoDuration = e.detail.duration
      }
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
        aligning: false,
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
      if (this.data._alignTimer) {
        clearInterval(this.data._alignTimer)
        this.data._alignTimer = 0
      }
      if (this.data._countdownTimer) {
        clearInterval(this.data._countdownTimer)
        this.data._countdownTimer = 0
      }
      const listener = this.data._frameListener
      if (listener) {
        try { listener.stop() } catch (e) {}
        this.data._frameListener = null
      }
      // 释放录制状态（直接丢弃未结束的录制）
      this.data._recording = false
      this.data._cameraCtx = null
      this.data._wantRecord = false
      const session = this.data._session
      if (session) {
        try { session.stop() } catch (e) {}
        try { session.destroy() } catch (e) {}
        this.data._session = null
      }
    },
  },
})
