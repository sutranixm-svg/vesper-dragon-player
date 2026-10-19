# Vesper · The Dragon Edition

一个黑金胶片风格的黑胶音乐播放器。唱盘随音乐转动，波形、频谱和低频重拍来自实际播放的音频。支持导入自己的歌曲，也能在浏览器里试听精选榜单。

![Vesper 项目封面](public/og.png)

[在线体验](https://vesper-obsidian-player.hajybdalstarthmanylm.chatgpt.site/) · [下载 Windows 版](https://github.com/sutranixm-svg/vesper-dragon-player/releases/latest) · [桌面版详细说明](desktop/README.md)

## 下载与开始使用

Windows 10 / 11 的 64 位电脑打开 [最新发布页](https://github.com/sutranixm-svg/vesper-dragon-player/releases/latest)，选择一个文件：

| 文件 | 适合谁 | 使用方法 |
| --- | --- | --- |
| `Vesper-1.0.0-Windows-x64-Setup.exe` | 想安装软件、创建快捷方式 | 下载后运行安装向导 |
| `Vesper-1.0.0-Windows-x64-Portable.exe` | 想直接试用 | 下载后双击运行，首次启动会稍慢 |
| `SHA256SUMS.txt` | 想核对下载文件 | 对照文件的 SHA-256 校验值 |

打开后可直接播放随附的 3 首原创示例；点击 **导入音频** 或拖入本地音频文件，即可播放自己的歌曲。界面、示例和本地歌曲可离线使用。在线榜单试听、封面和跳转到官方完整版需要网络连接。

软件目前没有商业代码签名，Windows 可能显示“未知发布者”；请从本仓库的发布页下载，并按需用 `SHA256SUMS.txt` 核对文件。桌面版不会自动安装更新。

## 主要功能

- 黑胶唱盘、唱针、胶片颗粒与暖金色反射；支持系统“减少动态效果”设置。
- 本地歌曲导入、搜索、收藏、随机与循环播放，以及进度和音量控制。
- 基于 Web Audio 实际音频数据绘制的 PCM 波形、对数频谱和低频重拍效果。
- 20 首全球英文榜单曲目的官方试听与完整版入口；可用性取决于地区和服务商。
- 手机单列触控布局，平板和桌面使用并列播放器与歌单。

本地导入的文件不会上传。当前版本关闭或刷新后需要重新选择本地文件，收藏也不会跨会话保存。项目不包含榜单商业歌曲的完整版。

## 本地开发

需要 Node.js 22.13+ 与 npm。在项目根目录运行：

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

生成 Windows 安装版与免安装版：

```sh
npm run desktop:test
npm run desktop:build
```

构建产物在 `release/`。网页版使用 React、Vinext 与 Cloudflare Workers；Windows 版通过 Electron 复用同一套播放器界面和音频分析逻辑。桌面版可脱离在线站点启动，官方音乐链接在系统浏览器中打开。更具体的打包方式和离线测试见[桌面版说明](desktop/README.md)。

## 关于节奏效果

波形读取播放中的 PCM 数据；频谱和重拍效果依据 40–240 Hz 的低频变化与自适应阈值判断，并设置 180 ms 的防重复触发窗口。它检测的是低频瞬态，不是完整的 BPM 或节拍标注；低音较少或切分复杂的歌曲可能出现漏检或误检。

项目为非官方致敬作品，与人物、唱片公司及榜单平台没有合作或隶属关系。
