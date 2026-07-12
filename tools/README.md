# 骨骼数据批量清洗

## 整体流程

```
小程序端导出列表 → 本地 Python 跑骨骼 → 小程序端上传 JSON
```

### 步骤 1：导出缺骨骼的视频列表

1. 在开发者工具打开 `pages/tools/fill-duration` 页面
2. 在 Console 里执行：
```js
wx.cloud.callFunction({
  name: 'fill_duration',
  data: { action: 'listNoSkeleton' }
}).then(res => {
  console.log(JSON.stringify(res.result.list))
})
```
3. 复制控制台输出的 JSON 数组，保存为 `tools/video_list.json`

### 步骤 2：本地跑骨骼识别

```bash
cd /Users/bandwbluo/git/dancing_game/tools
pip install ultralytics requests opencv-python
python batch_skeleton.py
```

脚本会逐个下载视频并用 YOLO pose 跑骨骼，输出到 `skeleton_output/` 目录。

### 步骤 3：上传骨骼 JSON 到云存储

在开发者工具 Console 里逐个上传（或写个循环）：
```js
// 读取 skeleton_output/_summary.json 的内容，逐条调云函数上传
const item = { _id: "记录ID", name: "歌名", content: "JSON字符串" }
wx.cloud.callFunction({
  name: 'fill_duration',
  data: { action: 'uploadSkeleton', id: item._id, name: item.name, content: item.content }
}).then(res => console.log(res.result))
```

或者使用 `pages/tools/upload-skeleton` 工具页批量上传（待开发）。

## 文件说明

- `batch_skeleton.py` — 本地 Python 脚本，下载视频 + YOLO pose 跑骨骼
- `video_list.json` — 从小程序端导出的视频列表（步骤1生成）
- `skeleton_output/` — 骨骼 JSON 输出目录（步骤2生成）
