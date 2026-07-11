// home.ts
// ============================================================
// 视频 meta 全部来自云数据库集合 `videos`，不再 hardcode 任何歌曲。
// 搜索框输入时从云端拉取并按关键词过滤；上传成功后写入云数据库。
// ============================================================
import { searchVideos, addVideo, VideoMeta } from '../../utils/videoRepo'
import { uploadVideo as cosUpload } from '../../utils/cosUpload'

type Song = VideoMeta

Component({
  data: {
    keyword: '',
    filtered: [] as Song[],
    loading: false,
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

    // 从云端搜索视频
    async applyFilter() {
      const kw = this.data.keyword.trim()
      if (!kw) { this.setData({ filtered: [] }); return }
      this.setData({ loading: true })
      try {
        const results = await searchVideos(kw)
        this.setData({ filtered: results })
      } catch (e) {
        console.error('[home] 搜索失败', e)
      } finally {
        this.setData({ loading: false })
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
      // song.video 即 cloud:// fileID
      wx.navigateTo({
        url: `../dance_search/dance_search?video=${encodeURIComponent(song.video)}&song=${encodeURIComponent(song.name)}&type=${encodeURIComponent(song.type)}`,
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
      console.log('[upload] onUploadTap 点击上传，弹出舞种选择')
      wx.showActionSheet({
        itemList: types,
        success: (res) => {
          const danceType = types[res.tapIndex]
          console.log('[upload] 用户选择舞种:', danceType)
          setTimeout(() => this.chooseVideo(danceType), 200)
        },
        fail: (err) => {
          console.warn('[upload] showActionSheet 取消/失败:', JSON.stringify(err))
        },
      })
    },

    chooseVideo(danceType: string) {
      console.log('[upload] chooseVideo 调用 wx.chooseMedia, danceType =', danceType)
      wx.chooseMedia({
        count: 1,
        mediaType: ['video'],
        sourceType: ['album'],
        camera: 'back',
        success: (res) => {
          console.log('[upload] chooseMedia success')
          if (!res.tempFiles || !res.tempFiles[0] || !res.tempFiles[0].tempFilePath) {
            wx.showToast({ title: '选择视频失败', icon: 'none' })
            return
          }
          const tempPath = res.tempFiles[0].tempFilePath
          wx.showModal({
            title: '输入舞蹈名称',
            content: '请为上传的舞蹈起个名字',
            editable: true,
            placeholderText: '如：我的舞蹈作品',
            success: (modalRes) => {
              if (!modalRes.confirm) return
              let songName = (modalRes.content || '').trim()
              if (!songName) songName = ''
              this.uploadVideoFile(tempPath, danceType, songName)
            },
          })
        },
        fail: (err) => {
          console.error('[upload] chooseMedia fail', JSON.stringify(err))
          if (err.errMsg && err.errMsg.includes('cancel')) return
          wx.showToast({ title: '选择视频失败', icon: 'none' })
        },
      })
    },

    uploadVideoFile(filePath: string, danceType: string, songName: string) {
      wx.showLoading({ title: '上传中...', mask: true })
      const safeName = (songName || `上传舞蹈_${Date.now()}`)
        .replace(/[\\/:*?"<>|\s]+/g, '_')
        .slice(0, 60)
      cosUpload({
        filePath,
        fileName: `common/${danceType}/${safeName}.mp4`,
        timeoutMs: 300000,
        onProgress: (p) => {
          wx.showLoading({ title: `上传 ${Math.round(p * 100)}%`, mask: true })
        },
      }).then((result) => {
        this.saveRecord(result.fileID, danceType, songName)
      }).catch((err) => {
        wx.hideLoading()
        console.error('[upload] 云上传失败', err)
        wx.showToast({ title: '上传失败，请重试', icon: 'none' })
      })
    },

    // 上传成功后写入云数据库
    async saveRecord(videoFileID: string, danceType: string, songName: string) {
      const name = songName || '上传舞蹈_' + Date.now()
      try {
        await addVideo({
          name,
          type: danceType,
          fileID: videoFileID,
          artist: '用户上传',
        })
        wx.hideLoading()
        wx.showToast({ title: '上传成功', icon: 'success' })
      } catch (e) {
        wx.hideLoading()
        console.error('[upload] 写入数据库失败', e)
        wx.showToast({ title: '上传成功，记录保存失败', icon: 'none' })
      }
    },
  },
})
