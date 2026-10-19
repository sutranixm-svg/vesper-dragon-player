# Vesper — The Dragon Edition

玻璃黑胶音乐播放器：李小龙电影风格背景、细腻胶片颗粒、金色反射、手机与平板布局。

[在线使用](https://vesper-obsidian-player.hajybdalstarthmanylm.chatgpt.site/)

[下载 Windows 软件](https://github.com/sutranixm-svg/vesper-dragon-player/releases/latest) · [桌面版说明](desktop/README.md)

## 功能

- 20 首榜单曲目的 Apple Music 官方试听、官方完整版入口。
- 导入本地音频、搜索、收藏、随机播放、循环播放、进度与音量控制。
- 真实 PCM 波形和对数频谱；低频突发检测控制粒子和重拍指示，不采用定时假律动。
- 暂停、缓冲、拖动进度和切歌会重置可视化；支持减少动态效果的系统偏好。
- 手机使用单列布局和大触控按钮，平板和桌面保留并列播放器与歌单。

## 开发

需要 Node.js 22.13+（建议 24）与 npm。

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build
```

项目使用 React、Vinext、Tailwind 和 Cloudflare Workers。`dist/server/index.js` 是部署入口，`dist/client` 为静态资源。现有 Sites 发布信息在 `.openai/hosting.json`；它不含访问密钥。GitHub 仓库提供源码，在线站点在上方链接。

## 节奏分析

分析器读取 Web Audio 的 PCM 与频谱。40–240 Hz 频带的正向谱变化与自适应阈值共同判断低频瞬态，设有 180ms 防重复触发窗口；粒子只由检测结果产生。频谱采用快速上升、缓慢衰减的显示平滑。它是低频瞬态检测，不是完整的 BPM 或音乐节拍标注系统；环境声、低音较少的音乐、复杂切分可能有漏检或误检。

测试覆盖静音、持续音、90/120/150 BPM 的合成输入、44.1/48 kHz 采样率、不同音量、高频抑制和切换重置。真实歌曲的主观同步感仍取决于曲目、设备及音频输出延迟。

Web Audio 参考：[频谱数据](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getFloatFrequencyData)、[分析平滑](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/smoothingTimeConstant)。

试听链接由原项目曲目数据提供，可能受地区或服务商可用性影响；仓库不包含这 20 首商业歌曲的完整版。本地导入的音频仅在设备浏览器内使用，刷新后需要重新选择。界面为非官方致敬作品。
