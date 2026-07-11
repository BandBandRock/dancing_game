// follow.ts — 最爱舞曲列表（从云数据库 favorites 集合读取）
import { resolveCloudFile } from '../../utils/cloudMedia'
import { loadFavorites, removeFavorite as removeFav, FavoriteItem } from '../../utils/favoriteRepo'

interface Song {
  name: string
  type: string
  video: string // cloud:// fileID
  _favId: string // favorites 集合记录 _id，用于取消收藏
}

Component({
  data: {
    keyword: '',
    musicList: [] as Song[],
    filteredList: [] as Song[],
    loading: false,
  },

  lifetimes: {
    attached() {
      this.loadFavoritesFromCloud()
    },
  },

  pageLifetimes: {
    show() {
      this.loadFavoritesFromCloud()
    },
  },

  methods: {
    async loadFavoritesFromCloud() {
      this.setData({ loading: true })
      try {
        const { list } = await loadFavorites()
        const musicList: Song[] = list.map((item: FavoriteItem) => ({
          name: item.name,
          type: item.type,
          video: item.fileID,
          _favId: item._id || '',
        }))
        this.setData({ musicList, filteredList: musicList })
      } catch (e) {
        console.error('[follow] loadFavorites 失败', e)
      } finally {
        this.setData({ loading: false })
      }
    },

    onSearchInput(e: any) {
      const keyword = e.detail.value.toLowerCase()
      this.setData({ keyword })
      const filtered = this.data.musicList.filter(
        (item) =>
          item.name.toLowerCase().includes(keyword) ||
          item.type.toLowerCase().includes(keyword),
      )
      this.setData({ filteredList: filtered })
    },

    async onMusicTap(e: any) {
      const index = e.currentTarget.dataset.index
      const list = this.data.filteredList
      if (index === undefined || index < 0 || index >= list.length) return
      const song = list[index]
      if (!song) return
      // song.video 即 cloud:// fileID，带到落地页播放
      wx.navigateTo({
        url: `../dance_search/dance_search?video=${encodeURIComponent(song.video)}&song=${encodeURIComponent(song.name)}&type=${encodeURIComponent(song.type)}`,
      })
    },

    // 取消收藏
    async removeFavorite(e: any) {
      const index = e.currentTarget.dataset.index
      const list = this.data.filteredList
      if (index === undefined || index < 0 || index >= list.length) return
      const song = list[index]
      if (!song || !song._favId) return

      const ok = await removeFav(song._favId)
      if (ok) {
        wx.showToast({ title: '取消收藏', icon: 'none' })
        this.loadFavoritesFromCloud()
      } else {
        wx.showToast({ title: '操作失败', icon: 'none' })
      }
    },
  },
})
