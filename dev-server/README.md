# 视频资源（云服务器）使用说明

本目录是**本地开发用**的视频服务，目的是让小程序在开发阶段无需把视频打进主包也能预览播放。
正式上线时**不需要本服务**，把视频放到你自己的云存储即可。

## 一、本地预览（开发阶段）

```bash
npm run dev:video          # 启动本地视频服务，默认 http://127.0.0.1:8081/video/
```

- 微信开发者工具需勾选「详情 → 本地设置 → 不校验合法域名…」才能加载 `127.0.0.1` 的视频。
- `miniprogram/pages/index/index.ts` 里的 `VIDEO_BASE` 默认指向本服务。
- 本服务内置 4 段 CC0 公开样例视频（bbb / flower / sintel / jellyfish），
  当某首歌的真实视频尚未上传时，会**按舞种前缀**回退到对应舞种的占位片段，避免黑屏。

## 二、正式上线：把视频放到云服务器

1. **拿到文件清单**：运行 `node dev-server/build-manifest.js` 生成 `video-manifest.json`，
   里面是全部 60 首歌的 `name / type / file`（file 即视频文件名）。
2. **上传视频**：把你的真实广场舞视频按 `file` 字段命名，上传到云存储，例如：
   - 腾讯云 COS：`https://your-bucket.cos.ap-guangzhou.myqcloud.com/video/gcd-01.mp4`
   - 阿里云 OSS：`https://your-bucket.oss-cn-guangzhou.aliyuncs.com/video/gcd-01.mp4`
3. **改基址**：把 `index.ts` 顶部的
   ```ts
   const VIDEO_BASE = 'http://127.0.0.1:8081/video/'
   ```
   改成你的云地址，例如：
   ```ts
   const VIDEO_BASE = 'https://your-bucket.cos.ap-guangzhou.myqcloud.com/video/'
   ```
4. **加白名单**：小程序后台 → 开发管理 → 服务器域名 → `request` 合法域名，
   加上你的云存储域名（如 `https://your-bucket.cos.ap-guangzhou.myqcloud.com`）。
5. 这样视频完全在云端，**不占小程序包体积**，且每首歌通过 `VIDEO_BASE + file` 精准匹配。

## 三、文件命名约定

| 前缀 | 舞种 | 占位片段 |
|------|------|----------|
| gcd- | 广场舞 | bbb.mp4 |
| jyx- | 交谊舞 | flower.mp4 |
| mz-  | 民族舞 | sintel.mp4 |
| js-  | 健身操 | jellyfish.mp4 |
| gb-  | 鬼步舞 | bbb.mp4 |

> 说明：当前 `dev-server/public/video/` 里的 4 段均为公开 CC0 样例，仅用于占位演示，
> **并非真实广场舞视频**。请替换为你自己的舞曲视频后再上线。

## 四、大视频（如本地 100MB 的 mp4）怎么播

小程序主包单包上限 2MB、整包 20MB，**大视频绝不能打进包**，只能放远程服务器用 `<video src>` 播。

### 方案 A：本地快速验证（开发阶段）
1. 把你的 100MB 文件复制到 `dev-server/public/video/`，例如命名 `big-dance.mp4`。
2. 让某首歌的 `video` 字段指向它（或临时把 `index.ts` 的 `VIDEO_BASE` 指向本地服务）。
3. 开发者工具勾选「不校验合法域名…」即可边下边播（本服务已支持 Range 流式传输）。

### 方案 B：简单上线（单文件 mp4 + HTTPS CDN）
1. 上传到支持 **Range 请求 + HTTPS** 的存储（腾讯云 COS / 阿里 OSS 等）。
2. 后台「服务器域名 → request 合法域名」加入该 HTTPS 域名。
3. 把 `VIDEO_BASE` 改成 CDN 地址。
4. ⚠️ 视频需为 **H.264 + AAC** 的 mp4，且最好 **faststart**（moov 头在前），否则大文件要等整段下完才播。转码：
   ```
   ffmpeg -i input.mp4 -c:v libx264 -c:a aac -movflags +faststart -crf 23 output.mp4
   ```

### 方案 C：最佳体验（100MB 推荐，转 HLS 切片）
单个大文件在移动网络下会狂缓冲。转成 `.m3u8` 切片，小程序 `<video>` 原生支持，自适应流畅播放：
```
ffmpeg -i input.mp4 -c:v libx264 -c:a aac -hls_time 10 -hls_list_size 0 output.m3u8
```
或直接用**腾讯云点播 VOD / 数据万象 CI**，上传后自动转码 HLS + CDN 分发，最省心。
（本服务已支持 `.m3u8` / `.ts` 的 MIME 与 Range 流式，本地也可直接验证 HLS。）

