# 001 - Dancing Game 小程序初版分析

> 创建时间：2026-07-10  
> 版本：初版（基础骨骼识别 + 可视化）

---

## 1. 项目概述

这是一个名为 **dancing_game（跳舞游戏）** 的微信小程序，核心功能是利用微信 **VisionKit** 的人体姿态识别能力，通过前置摄像头实时检测人体骨骼关键点并在 Canvas 上渲染骨骼覆盖层。

当前阶段实现了"跳舞游戏"的基础设施——实时人体骨骼追踪和可视化，后续可在此基础上添加舞蹈动作匹配、评分系统等游戏逻辑。

---

## 2. 项目结构

```
dancing_game/
├── package.json                      # npm 配置
├── project.config.json               # 微信小程序项目配置
├── tsconfig.json                     # TypeScript 编译配置
├── miniprogram/
│   ├── app.ts                        # 应用入口
│   ├── app.json                      # 全局配置（页面注册、窗口设置）
│   ├── app.wxss                      # 全局样式
│   ├── utils/
│   │   └── util.ts                   # 工具函数（formatTime）
│   └── pages/
│       ├── index/                    # 首页（用户信息 + 入口按钮）
│       ├── logs/                     # 日志页（显示启动日志）
│       └── pose/                     # 姿态识别核心页
└── typings/
    ├── index.d.ts                    # IAppOption 接口定义
    ├── vk.d.ts                       # VisionKit 自定义类型声明
    └── types/                        # 微信小程序官方类型定义
```

---

## 3. 核心配置

| 配置项 | 值 |
|--------|-----|
| AppID | `wx4f4bc4dec97d474b` |
| 编译器 | TypeScript（插件模式） |
| 渲染引擎 | Skyline |
| 组件框架 | glass-easel |
| 基础库版本 | trial |
| 依赖 | `miniprogram-api-typings`（devDep） |

---

## 4. 页面流程

```
首页 (index) ──点击"开始姿态识别"──→ 姿态识别页 (pose)
     │
     └──点击头像──→ 日志页 (logs)
```

### 4.1 首页 (`pages/index`)

- 显示用户头像和昵称
- 支持 `chooseAvatar` 和 `getUserProfile` 两种方式获取用户信息
- 底部绿色按钮 **"开始姿态识别"**，点击跳转到 `pose` 页面

### 4.2 日志页 (`pages/logs`)

- 从 localStorage 读取应用启动日志
- 格式化后展示时间列表

### 4.3 姿态识别页 (`pages/pose`) —— 核心页面

- 全屏黑色背景，摄像头画面占满屏幕
- 顶部 HUD 显示：状态文字、检测到的人体数量、FPS
- 底部"镜像"切换按钮
- 设备不支持时显示降级提示

---

## 5. VisionKit 接入方案

### 5.1 架构设计

采用 **mode:2（手动送帧）** 模式：

1. `<camera>` 组件负责显示前置摄像头画面
2. `onCameraFrame` 回调获取每一帧原始图像数据
3. 手动调用 `session.detectBody()` 将帧数据送入 VisionKit
4. 检测结果通过 `updateAnchors` / `removeAnchors` 事件回调返回
5. Canvas 2D 实时绘制骨骼覆盖层

### 5.2 初始化流程

```
checkAndInit()
  → 检查 wx.createVKSession 是否存在（版本兼容）
  → 检查摄像头权限 (scope.camera)
  → initCanvas() - 创建 Canvas 2D 上下文，设置 DPR
  → initVK() - 创建 VKSession
      → wx.createVKSession({ track: { body: { mode: 2 } } })
      → 监听 'updateAnchors' 和 'removeAnchors'
      → session.start()
      → startFrameFeed() - 开始抽帧送检
      → startRenderLoop() - 开始渲染循环
```

### 5.3 帧处理（流控）

```typescript
// 核心流控逻辑：单帧检测未完成时跳过后续帧，防止堆积
onCameraFrame(frame) {
  if (_detecting) return;  // 上一帧还没处理完，跳过
  _detecting = true;
  session.detectBody({
    frameBuffer: frame.data,
    width, height,
    scoreThreshold: 0.2,
    sourceType: 0  // 视频连续帧
  });
}
// 'updateAnchors' 回调中重置 _detecting = false
```

### 5.4 骨骼渲染

使用 Canvas 2D + `requestAnimationFrame` 渲染循环：

| 渲染元素 | 颜色 | 说明 |
|----------|------|------|
| 检测框 | `#FF3B30`（红色） | 标出人体范围 |
| 骨架连线 | `#FFD43B`（黄色） | COCO-17 关键点连线 |
| 关键点 | `#5DCAA5`（绿色） | 每个关键点圆点 |

**坐标映射**：VisionKit 返回 0~1 归一化坐标 → aspect-fill（cover）校正 → Canvas 像素坐标  
**置信度过滤**：只绘制 confidence >= 0.3 的关键点

### 5.5 骨架定义（COCO-17 关键点）

```
 0: 鼻      1: 左眼    2: 右眼    3: 左耳    4: 右耳
 5: 左肩    6: 右肩    7: 左肘    8: 右肘    9: 左腕   10: 右腕
11: 左髋   12: 右髋   13: 左膝   14: 右膝   15: 左踝   16: 右踝
```

连线关系：双肩、左右臂、双髋、躯干（肩→髋）、左右腿、头到肩

---

## 6. 类型声明

由于旧版 `miniprogram-api-typings` 未包含 VisionKit 类型，项目在 `typings/vk.d.ts` 中自行声明了：

- `VKSession` — 会话接口（start / stop / destroy / on / detectBody）
- `VKBodyAnchor` — 人体锚点（23个2D关键点、检测框、置信度、可选3D点）
- `VKSessionOptions` — 创建会话参数（支持 body / face / hand / plane 追踪）

---

## 7. 技术特点总结

| 方面 | 说明 |
|------|------|
| 框架 | 微信小程序 + TypeScript + glass-easel |
| AI 能力 | 微信 VisionKit 人体姿态检测（17 关键点） |
| 渲染 | Canvas 2D + requestAnimationFrame 实时骨骼渲染 |
| 流控 | 单帧检测锁，防止帧堆积 |
| 坐标映射 | aspect-fill 裁剪 + 前置摄像头镜像翻转 |
| 降级处理 | 版本检测、权限检查、设备兼容提示 |
| 性能监控 | 实时 FPS 显示 |

---

## 8. 待开发方向（建议）

- [ ] 舞蹈动作模板定义与匹配算法
- [ ] 动作评分系统
- [ ] 音乐节拍同步
- [ ] 多人对战模式
- [ ] 动作录制与回放
