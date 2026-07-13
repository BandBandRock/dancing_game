// app.ts
App<IAppOption>({
  globalData: {
    // 对齐阶段（游戏开始前）的可调参数，真机可不重编译直接改 globalData 调
    align: {
      hold: 3000,        // 需站定时长(ms)
      boxMargin: 0.30,   // 躯干目标框边距（占屏比例）→ 框更宽松
      minTorso: 0.12,    // 躯干最小占屏高（站太远下限）
      maxTorso: 0.75,    // 躯干最大占屏高（iPad 摄像头窄视角，人显得大，大幅放宽上限）
    },
    // 打分算法切换（内部配置，不暴露给前端 UI）
    // 'simple'  = 简单版：只检测手脚运动幅度打分，不依赖教练骨骼
    // 'skeleton' = 骨骼相似版：逐帧对比教练骨骼相似度打分，需要 skeletonFileID
    scoreAlgorithm: 'simple' as 'simple' | 'skeleton',
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
