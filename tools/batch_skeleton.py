#!/usr/bin/env python3
"""
batch_skeleton.py — 本地批量骨骼清洗脚本

流程：
  1. 调云函数获取所有缺骨骼数据的视频列表（含临时下载 URL）
  2. 逐个下载视频 → YOLO pose 跑骨骼 → 生成 JSON
  3. 调云函数上传 JSON 到云存储并写回 skeletonFileID

使用：
  cd /Users/bandwbluo/git/dancing_game/tools
  pip install ultralytics requests
  python batch_skeleton.py

前置条件：
  - Python 3.8+
  - ultralytics（YOLO）
  - requests
  - 微信开发者工具开着（云函数通过 HTTP 调用）

注意：
  云函数 HTTP 调用需要用「云开发 HTTP API」或在开发者工具里开启「云函数本地调试」。
  这里用最简单的方案：直接通过微信小程序的云函数 HTTP 触发（需要在云开发控制台开启 HTTP 访问）。
  如果没开，也可以手动操作：脚本只负责下载+跑骨骼+输出 JSON，手动上传。

  === 推荐的简易方案 ===
  由于云函数 HTTP 调用配置较麻烦，本脚本采用「半自动」模式：
  - 第一步：在小程序端（工具页）调云函数拿到视频列表+临时URL，复制到本地 JSON 文件
  - 第二步：本脚本读取该 JSON，下载视频并跑骨骼
  - 第三步：输出所有骨骼 JSON 文件，再通过小程序端工具页批量上传

  或者用下面的全自动模式（需配置 API 访问）。
"""

import os
import sys
import json
import requests
import tempfile
from pathlib import Path

# ===== 配置 =====
# 方式1：从本地 JSON 文件读取视频列表（小程序端导出）
INPUT_JSON = "video_list.json"  # 格式: [{"_id": "xxx", "name": "xxx", "tempURL": "https://..."}]
# 输出目录
OUTPUT_DIR = "skeleton_output"
# =================

try:
    from ultralytics import YOLO
except ImportError:
    print("请先安装 ultralytics: pip install ultralytics")
    sys.exit(1)

import cv2

# YOLO 模型（首次运行会自动下载）
# n=nano, s=small, m=medium, l=large, x=xlarge
# 越大精度越高但越慢，pose 场景建议 m 或 l
MODEL_PATH = "yolo11n-pose.pt"
KP_THRESH = 0.3


def pick_center_person(r, frame_w):
    """从多人检测结果里选最靠近画面中心的人，返回 [17,3] 关键点列表。"""
    if r.keypoints is None or len(r.keypoints) == 0:
        return None
    kps = r.keypoints.data.cpu().numpy()
    cx_frame = frame_w / 2.0

    boxes = getattr(r, "boxes", None)
    if boxes is not None and boxes.xywh is not None and len(boxes.xywh) == len(kps):
        centers_x = boxes.xywh.cpu().numpy()[:, 0]
    else:
        centers_x = []
        for person in kps:
            vis = person[person[:, 2] > KP_THRESH]
            centers_x.append(vis[:, 0].mean() if len(vis) else cx_frame)

    best = min(range(len(kps)), key=lambda i: abs(centers_x[i] - cx_frame))
    return kps[best].tolist()


def process_video(video_path, output_json):
    """对单个视频跑 YOLO pose，输出骨骼 JSON。"""
    print(f"  加载模型 {MODEL_PATH}...")
    model = YOLO(MODEL_PATH)
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"  视频信息: {total_frames} 帧, {fps:.1f} fps, 时长 {total_frames/fps:.1f}s")
    print(f"  开始识别...")

    # 每 200ms 采样一帧（与小程序端对齐）
    sample_interval = int(round(fps * 0.2))  # 30fps → 每6帧取1帧
    if sample_interval < 1:
        sample_interval = 1
    print(f"  采样间隔: 每 {sample_interval} 帧 (≈200ms/次)")

    frames = []
    frame_idx = 0
    sampled = 0

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        if frame_idx % sample_interval == 0:
            r = model(frame, verbose=False)[0]
            kp = pick_center_person(r, frame.shape[1])
            frames.append({"t": round(frame_idx / fps, 3), "kp": kp})
            sampled += 1

            # 每 20 次采样打印进度
            if sampled % 20 == 0:
                pct = frame_idx / total_frames * 100 if total_frames else 0
                print(f"  进度: {frame_idx}/{total_frames} ({pct:.0f}%) 已采样 {sampled} 帧")

        frame_idx += 1

    cap.release()

    with open(output_json, "w") as f:
        json.dump(frames, f)

    print(f"  ✅ 完成! 总帧数 {frame_idx}, 采样 {sampled} 帧 @ 200ms间隔 → {output_json}")
    return frames


def download_video(url, dest_path):
    """下载视频到本地。"""
    print(f"  下载中...")
    r = requests.get(url, stream=True, timeout=120)
    r.raise_for_status()
    with open(dest_path, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            f.write(chunk)
    size_mb = os.path.getsize(dest_path) / 1024 / 1024
    print(f"  下载完成 ({size_mb:.1f} MB)")


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 读取视频列表
    if not os.path.exists(INPUT_JSON):
        print(f"未找到 {INPUT_JSON}")
        print(f"请先在小程序工具页调用云函数 fill_duration(action='listNoSkeleton')，")
        print(f"将返回的 list 保存为 {INPUT_JSON} 文件。")
        print(f"格式: [{{\"_id\": \"xxx\", \"name\": \"歌名\", \"tempURL\": \"https://...\"}}]")
        sys.exit(1)

    with open(INPUT_JSON) as f:
        video_list = json.load(f)

    print(f"共 {len(video_list)} 个视频需要处理\n")

    results = []
    for i, item in enumerate(video_list):
        name = item.get("name", f"video_{i}")
        url = item.get("tempURL", "")
        _id = item.get("_id", "")

        print(f"[{i+1}/{len(video_list)}] {name}")

        if not url:
            print("  跳过：无下载地址")
            continue

        # 下载视频
        safe_name = name.replace("/", "_").replace(" ", "_")[:60]
        video_path = os.path.join(tempfile.gettempdir(), f"{safe_name}.mp4")
        json_out = os.path.join(OUTPUT_DIR, f"{safe_name}_coco17.json")

        try:
            download_video(url, video_path)
            process_video(video_path, json_out)
            results.append({"_id": _id, "name": name, "json_file": json_out})
        except Exception as e:
            print(f"  失败: {e}")
        finally:
            if os.path.exists(video_path):
                os.remove(video_path)

        print()

    # 输出汇总
    summary_path = os.path.join(OUTPUT_DIR, "_summary.json")
    with open(summary_path, "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n完成！共处理 {len(results)} 个视频")
    print(f"骨骼 JSON 文件在: {OUTPUT_DIR}/")
    print(f"汇总文件: {summary_path}")
    print(f"\n下一步：在小程序工具页批量上传这些 JSON 文件到云存储。")


if __name__ == "__main__":
    main()
