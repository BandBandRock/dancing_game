// pages/feedback/feedback.ts
// 跳舞结束后的反馈页：
// - 不直接保存历史，先展示成绩与本人跳舞视频
// - 四个按钮：重跳 / 保存 / 分享 / 退出
import { addHistory } from '../../utils/danceHistory'
import { uploadVideo } from '../../utils/cosUpload'

interface PendingDance {
  song: string
  type: string // 舞种（广场舞/交谊舞…），用于退出后跳回该舞种列表
  score: number
  date: string
  hour: number
  minute: number
  video: string // 本人跳舞视频（云端 fileID 或本地兜底）
  teach: string // 教学视频，供「重跳」复用
  skeleton?: string // 用户跳舞骨骼序列云端地址（cloud:// fileID），供「呈现骨骼视频」回放
  rate?: number // 教学视频倍速（0.5/0.8 等），回放时教练视频同步
}

Page({
  data: {
    song: '',
    type: '',
    score: 60,
    date: '',
    hour: 0,
    minute: 0,
    timeText: '',
    video: '',
    teach: '',
    skeleton: '',
    rate: 0.8,
    saved: false,
    saving: false,
    saveLabel: '保存',
    showShare: false,
  },

  onLoad() {
    const p = wx.getStorageSync('__pendingDance') as PendingDance | ''
    if (p && typeof p === 'object') {
      const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
      this.setData({
        song: p.song,
        type: p.type || '',
        score: p.score,
        date: p.date,
        hour: p.hour,
        minute: p.minute,
        timeText: pad(p.hour) + ':' + pad(p.minute),
        video: p.video,
        teach: p.teach,
        skeleton: p.skeleton || '',
        rate: p.rate || 0.8,
      })
    }
  },

  // 重跳：回到同一首歌的跳舞页
  onRedance() {
    const url =
      '../pose/pose?video=' +
      encodeURIComponent(this.data.teach) +
      '&song=' +
      encodeURIComponent(this.data.song) +
      '&type=' +
      encodeURIComponent(this.data.type)
    wx.redirectTo({ url })
  },

  // 统一保存逻辑（幂等）：已保存直接返回；保存中则等待其完成；否则执行保存
  // silent=true 时不弹 loading/toast（用于分享真正发生时触发的后台保存，避免遮挡系统分享面板）
  performSave(silent = false): Promise<void> {
    if (this.data.saved) return Promise.resolve()
    if (this.data.saving) {
      // 正在保存中，轮询等其结束
      return new Promise((resolve) => {
        const t = setInterval(() => {
          if (this.data.saved || !this.data.saving) {
            clearInterval(t)
            resolve()
          }
        }, 150)
      })
    }
    this.setData({ saving: true, saveLabel: '保存中…' })
    if (!silent) wx.showLoading({ title: '保存中…', mask: true })
    return this.doSave()
      .then(() => {
        if (!silent) wx.hideLoading()
        this.setData({ saved: true, saving: false, saveLabel: '已保存' })
        if (!silent) wx.showToast({ title: '已保存到云开发', icon: 'success' })
      })
      .catch(() => {
        if (!silent) wx.hideLoading()
        this.setData({ saving: false, saveLabel: '保存' })
        if (!silent) wx.showToast({ title: '保存失败', icon: 'none' })
      })
  },

  // 保存：上传云端 + 写入历史（独立按钮）
  onSave() {
    this.performSave()
  },

  // 真正执行保存（上传 + 写历史），返回最终 video（云端 fileID 或本地兜底路径）
  doSave(): Promise<string> {
    // pose 端已把视频上传云端（video 已是 cloud:// fileID），直接复用，避免重复上传；
    // 若为本地兜底路径则在此上传。骨骼已是云端 fileID，原样写入历史。
    const video = this.data.video
    const upload$ = typeof video === 'string' && video.indexOf('cloud://') === 0
      ? Promise.resolve(video)
      : uploadVideo({
          filePath: video,
          fileName: `dance_${Date.now()}.mp4`,
          timeoutMs: 300000,
        })
          .then((res: any) => res.fileID)
          .catch((e: any) => {
            console.error('[feedback] 云端上传失败，用本地路径兜底', e)
            return '' // 云端失败：用本地路径兜底
          })

    return upload$.then((fid: string) => {
      const finalVideo = fid || video
      return addHistory({
        song: this.data.song,
        score: this.data.score,
        date: this.data.date,
        hour: this.data.hour,
        minute: this.data.minute,
        video: finalVideo,
        skeleton: this.data.skeleton || undefined,
        teach: this.data.teach || undefined,
        rate: this.data.rate,
      }).then(() => {
        wx.removeStorageSync('__pendingDance')
        return finalVideo
      })
    })
  },

  // 分享：只弹出选择，不立即保存（保存推迟到用户选定分享方式之后）
  onShare() {
    this.setData({ showShare: true })
  },

  // 分享给微信好友：仅关闭弹窗；真正的保存推迟到分享真正发生时（onShareAppMessage 内）
  onShareFriend() {
    this.setData({ showShare: false })
  },

  closeShare() {
    this.setData({ showShare: false })
  },

  onPickShare(e: any) {
    const method = e.currentTarget.dataset.method
    if (method === 'timeline') {
      // 仅开启右上角朋友圈分享入口；保存推迟到用户真正分享时（onShareTimeline 内）
      this.setData({ showShare: false })
      wx.showShareMenu({
        withShareTicket: false,
        menus: ['shareAppMessage', 'shareTimeline'],
        success: () => {
          wx.showToast({ title: '请点击右上角 ··· 分享到朋友圈', icon: 'none' })
        },
      })
    }
    // method === 'friend' 由 <button open-type="share"> 触发，走 onShareAppMessage
  },

  noop() {},

  // 退出：回到该舞种的歌曲列表页
  onExit() {
    const type = this.data.type
    const url = type
      ? `../dance_search/dance_search?type=${encodeURIComponent(type)}`
      : '../dance_search/dance_search'
    wx.reLaunch({ url })
  },

  // 构造分享落地页路径（带完整参数）
  _sharePath() {
    return (
      `pages/shared/shared?song=${encodeURIComponent(this.data.song)}` +
      `&score=${this.data.score}` +
      `&teach=${encodeURIComponent(this.data.teach || '')}` +
      `&video=${encodeURIComponent(this.data.video || '')}` +
      `&rate=${this.data.rate}` +
      `&date=${encodeURIComponent(this.data.date || '')}` +
      `&hour=${this.data.hour}` +
      `&minute=${this.data.minute}`
    )
  },

  // 分享给微信好友（点弹窗里的「分享给微信好友」按钮触发）：分享真正发出后再保存
  onShareAppMessage() {
    this.performSave(true) // 后台静默保存，不遮挡系统分享面板
    return {
      title: `我跳了《${this.data.song}》，平均分 ${this.data.score}！快来一起跳～`,
      path: this._sharePath(),
    }
  },

  // 分享到朋友圈：同理，分享真正发生时再保存
  onShareTimeline() {
    this.performSave(true)
    return {
      title: `我跳了《${this.data.song}》，平均分 ${this.data.score}！`,
      query: this._sharePath().split('?')[1] || '',
    }
  },
})
