// app.ts
App<IAppOption>({
  globalData: {},
  onLaunch() {
    // 初始化微信云开发（用于云存储 fileID 读写）
    if (!wx.cloud) {
      console.error('当前基础库版本过低，不支持云开发，请升级到 2.2.3 以上')
    } else {
      wx.cloud.init({
        env: 'cloud1-d9gm4mnma453a20a7',
        traceUser: true,
      })
    }

    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        console.log(res.code)
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      },
    })
  },
})