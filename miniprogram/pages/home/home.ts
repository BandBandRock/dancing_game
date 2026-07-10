// home.ts
Component({
  data: {
    keyword: '',
    shaking: {
      search: false,
      ballroom: false,
      square: false,
      folk: false,
      health: false,
      debug: false,
    },
  },

  methods: {
    onSearchInput(e: any) {
      this.setData({ keyword: e.detail.value })
    },

    doSearch() {
      this.setData({ 'shaking.search': true })
      setTimeout(() => {
        this.setData({ 'shaking.search': false })
      }, 350)

      const keyword = this.data.keyword.trim()
      if (!keyword) return

      wx.navigateTo({
        url: `../search/search?keyword=${encodeURIComponent(keyword)}`,
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

    goRank() {
      wx.navigateTo({
        url: '../rank/rank',
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
  },
})
