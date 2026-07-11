// search.ts
// ============================================================
// 视频 meta 全部来自云数据库集合 `videos`，不再 hardcode 任何歌曲。
// 搜索时从云端拉取并按关键词过滤；video 字段即 cloud:// fileID。
// 收藏读写云数据库集合 `favorites`。
// ============================================================
import { searchVideos, VideoMeta } from '../../utils/videoRepo'
import { loadFavorites, addFavorite, removeFavorite } from '../../utils/favoriteRepo'

type Song = VideoMeta

Component({
  data: {
    keyword: '',
    results: [] as Song[],
    loading: false,
    favoritedKeys: {} as Record<string, string>,
    shaking: {
      search: false,
    },
  },

  lifetimes: {
    async attached() {
      // 加载收藏状态（从云数据库）
      try {
        const { keys } = await loadFavorites()
        this.setData({ favoritedKeys: keys })
      } catch (e) {
        console.error('[search] loadFavorites 失败', e)
      }

      // 从首页带入的关键词
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      const options = (currentPage as any).options || {}
      const keyword = decodeURIComponent(options.keyword || '')
      if (keyword) {
        this.setData({ keyword })
        this.doSearch()
      }
    },
  },

  methods: {
    onKeywordInput(e: any) {
      this.setData({ keyword: e.detail.value })
    },

    onClear() {
      this.setData({ keyword: '', results: [] })
    },

    async doSearch() {
      this.setData({ 'shaking.search': true })
      setTimeout(() => {
        this.setData({ 'shaking.search': false })
      }, 350)
      const kw = this.data.keyword.trim()
      if (!kw) { this.setData({ results: [] }); return }

      this.setData({ loading: true })
      try {
        const results = await searchVideos(kw)
        this.setData({ results })
      } catch (e) {
        console.error('[search] 搜索失败', e)
        wx.showToast({ title: '搜索失败，请重试', icon: 'none' })
      } finally {
        this.setData({ loading: false })
      }
    },

    onSongTap(e: any) {
      const index = e.currentTarget.dataset.index
      const results = this.data.results
      if (index === undefined || index < 0 || index >= results.length) return
      const song = results[index]
      if (!song) return
      // song.video 即 cloud:// fileID，直接带到落地页
      wx.navigateTo({
        url: `../dance_search/dance_search?video=${encodeURIComponent(song.video)}&song=${encodeURIComponent(song.name)}&type=${encodeURIComponent(song.type)}`,
      })
    },

    // 切换收藏（写云数据库）
    async toggleFavorite(e: any) {
      const key = e.currentTarget.dataset.key as string
      const index = e.currentTarget.dataset.index
      const results = this.data.results
      if (index === undefined || index < 0 || index >= results.length) return
      const song = results[index]

      const fav = { ...this.data.favoritedKeys }
      if (fav[key]) {
        const ok = await removeFavorite(fav[key])
        if (ok) {
          delete fav[key]
          wx.showToast({ title: '取消收藏', icon: 'none' })
        } else {
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      } else {
        const id = await addFavorite({
          name: song.name,
          type: song.type,
          fileID: song.video,
        })
        if (id) {
          fav[key] = id
          wx.showToast({ title: '已收藏', icon: 'success' })
        } else {
          wx.showToast({ title: '操作失败', icon: 'none' })
        }
      }
      this.setData({ favoritedKeys: fav })
    },
  },
})
