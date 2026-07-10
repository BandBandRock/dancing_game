// typings/vk.d.ts
// VisionKit VKSession 最小类型声明（旧版 miniprogram-api-typings 未包含）

interface VKAnchorPoint {
  x: number
  y: number
}

interface VKBodyAnchor {
  /** 23 个 2D 关键点，归一化坐标 0~1 */
  points: VKAnchorPoint[]
  /** 检测框左上角 */
  origin?: VKAnchorPoint
  /** 检测框尺寸 */
  size?: { width: number; height: number }
  /** 检测框置信度 */
  score?: number
  /** 每个关键点的置信度 */
  confidence?: number[]
  /** 3D 关键点（开启 open3d 后） */
  points3d?: { x: number; y: number; z: number }[]
}

type VKEvent = 'updateAnchors' | 'removeAnchors' | 'addAnchors'

interface VKSession {
  start(callback: (errno: number | null) => void): void
  stop(): void
  destroy(): void
  on(event: VKEvent, callback: (anchors: VKBodyAnchor[]) => void): void
  update3DMode(opts: { open3d: boolean }): void
  detectBody(opts: {
    frameBuffer: ArrayBuffer
    width: number
    height: number
    scoreThreshold?: number
    sourceType?: number
    open3d?: boolean
  }): void
}

interface VKSessionOptions {
  track: {
    body?: { mode: 1 | 2 }
    face?: { mode: 1 | 2 }
    hand?: { mode: 1 | 2 }
    plane?: { mode: number }
  }
  version?: string
  gl?: unknown
}
