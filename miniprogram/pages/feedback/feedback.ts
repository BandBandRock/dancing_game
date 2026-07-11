// pages/feedback/feedback.ts
// 跳舞结束后的反馈页：
// - 不直接保存历史，先展示成绩与本人跳舞视频
// - 四个按钮：重跳 / 保存 / 分享 / 退出
import { addHistory } from '../../utils/danceHistory'
import { uploadVideo } from '../../utils/cosUpload'

interface PendingDance {
  song: string
  score: number
  date: string
  hour: number
  minute: number
  video: string // 本地持久化的本人跳舞视频
  teach: string // 教学视频，供「重跳」复用
}

Page({
  data: {
    song: '',
    score: 60,
    date: '',
    hour: 0,
    minute: 0,
    timeText: '',
    video: '',
    teach: '',
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
        score: p.score,
        date: p.date,
        hour: p.hour,
        minute: p.minute,
        timeText: pad(p.hour) + ':' + pad(p.minute),
        video: p.video,
        teach: p.teach,
      })
    }
  },

  // 重跳：回到同一首歌的跳舞页
  onRedance() {
    const url =
      '../pose/pose?video=' +
      encodeURIComponent(this.data.teach) +
      '&song=' +
      encodeURIComponent(this.data.song)
    wx.redirectTo({ url })
  },

  // 保存：上传云端 + 写入历史
  onSave() {
    if (this.data.saved || this.data.saving) return
    this.setData({ saving: true, saveLabel: '保存中…' })
    wx.showLoading({ title: '保存中…', mask: true })
    this.doSave()
      .then(() => {
        wx.hideLoading()
        this.setData({ saved: true, saving: false, saveLabel: '已保存' })
        wx.showToast({ title: '已保存到云开发', icon: 'success' })
      })
      .catch(() => {
        wx.hideLoading()
        this.setData({ saving: false, saveLabel: '保存' })
        wx.showToast({ title: '保存失败', icon: 'none' })
      })
  },

  // 真正执行保存（上传 + 写历史），返回最终 video（云端 fileID 或本地兜底路径）
  doSave(): Promise<string> {
    return uploadVideo({
      filePath: this.data.video,
      fileName: `dance_${Date.now()}.mp4`,
      timeoutMs: 300000,
    })
      .then((res: any) => res.fileID)
      .catch((e: any) => {
        console.error('[feedback] 云端上传失败，用本地路径兜底', e)
        return '' // 云端失败：用本地路径兜底
      })
      .then((fid: string) => {
        const finalVideo = fid || this.data.video
        addHistory({
          song: this.data.song,
          score: this.data.score,
          date: this.data.date,
          hour: this.data.hour,
          minute: this.data.minute,
          video: finalVideo,
        })
        wx.removeStorageSync('__pendingDance')
        return finalVideo
      })
  },

  // 分享：先确保已保存，再弹分享选择
  onShare() {
    if (!this.data.saved) {
      if (this.data.saving) return
      this.setData({ saving: true, saveLabel: '保存中…' })
      wx.showLoading({ title: '准备中…', mask: true })
      this.doSave()
        .then(() => {
          wx.hideLoading()
          this.setData({ saved: true, saving: false, saveLabel: '已保存' })
          wx.showToast({ title: '已保存', icon: 'success' })
          this.setData({ showShare: true })
        })
        .catch(() => {
          wx.hideLoading()
          this.setData({ saving: false, saveLabel: '保存' })
          wx.showToast({ title: '保存失败，无法分享', icon: 'none' })
        })
    } else {
      this.setData({ showShare: true })
    }
  },

  closeShare() {
    this.setData({ showShare: false })
  },

  onPickShare(e: any) {
    const method = e.currentTarget.dataset.method
    if (method === 'timeline') {
      wx.showShareMenu({
        withShareTicket: false,
        menus: ['shareAppMessage', 'shareTimeline'],
        success: () => {
          wx.showToast({ title: '请点击右上角 ··· 分享到朋友圈', icon: 'none' })
        },
      })
      this.setData({ showShare: false })
    } else if (method === 'copy') {
      const path = 'pages/dance_search/dance_search'
      wx.setClipboardData({
        data: `一起来跳《${this.data.song}》吧！小程序路径：${path}`,
        success: () => {
          wx.showToast({ title: '链接已复制', icon: 'success' })
        },
      })
      this.setData({ showShare: false })
    }
    // method === 'friend' 由 <button open-type="share"> 触发，走 onShareAppMessage
  },

  noop() {},

  // 退出：回到选歌页
  onExit() {
    wx.reLaunch({ url: '../dance_search/dance_search' })
  },

  // 分享给微信好友（点弹窗里的「分享给微信好友」按钮触发）
  onShareAppMessage() {
    return {
      title: `我跳了《${this.data.song}》，平均分 ${this.data.score}！快来一起跳～`,
      path: 'pages/dance_search/dance_search',
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: `我跳了《${this.data.song}》，平均分 ${this.data.score}！`,
    }
  },
})
