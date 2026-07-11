// app.ts
App<IAppOption>({
  globalData: {
    // 对齐阶段（游戏开始前）的可调参数，真机可不重编译直接改 globalData 调
    align: {
      hold: 3000,        // 需站定时长(ms)
      boxMargin: 0.25,   // 躯干目标框边距（占屏比例）→ 框=0.5屏居中
      minTorso: 0.15,    // 躯干最小占屏高（站太远下限）
      maxTorso: 0.42,    // 躯干最大占屏高（站太近上限）
    },
  },
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

// 全局配置类型
export interface AlignConfig {
  hold: number      // 需站定时长(ms)
  boxMargin: number // 躯干目标框边距（占屏比例）
  minTorso: number  // 躯干最小占屏高
  maxTorso: number  // 躯干最大占屏高
}

export interface IAppOption {
  globalData: {
    align: AlignConfig
    [key: string]: any
  }
  [key: string]: any
}
