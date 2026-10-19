# Vesper Windows 版

Windows 10 / 11，64 位（x64）。播放器界面、背景和 3 首原创示例音频随软件打包。

## 下载使用

从 [GitHub Releases](https://github.com/sutranixm-svg/vesper-dragon-player/releases) 下载：

- `Vesper-1.0.0-Windows-x64-Setup.exe`：安装版，可选择安装目录，并创建桌面和开始菜单快捷方式。
- `Vesper-1.0.0-Windows-x64-Portable.exe`：免安装版，下载后双击运行；首次启动需要解压，稍等片刻。
- `SHA256SUMS.txt`：两个可执行文件的 SHA-256 校验值。

点击“导入音频”选择自己的歌曲，或把音频文件拖到播放器。界面、本地文件与原创示例可以离线使用；榜单试听、封面和官方完整版入口需要联网。导入不会上传文件，但当前版本关闭后需重新选择文件，收藏也不跨会话保存。

按 Alt 显示菜单，可缩放、全屏、查看版本和打开下载更新页。本版本不自动下载或安装更新。软件未使用商业代码签名证书，Windows 可能显示“未知发布者”；以本仓库 Release 和文件校验值确认来源。

## 开发与验证

在项目根目录运行：

```sh
npm ci
npm run desktop:dev
npm run desktop:test
npm run desktop:build
```

构建产物位于 `release/`。桌面版通过独立 Vite 入口复用 `app/page.tsx`、视觉样式与音频分析代码，不依赖远程网站或本地后台服务。安装包仅收录编译后的界面、桌面主进程与运行时。

主进程使用 [Electron 自定义协议](https://www.electronjs.org/docs/latest/api/protocol) 提供包内资源，启用沙箱、上下文隔离并关闭页面 Node 集成；官方音乐入口在默认浏览器打开。[安装器使用 NSIS](https://www.electron.build/nsis/)。

`--vesper-self-test` 是显式启用的验收模式：需设置绝对路径环境变量 `VESPER_TEST_OUTPUT`；隐藏窗口、阻断 HTTP/HTTPS，验证离线加载、播放、拖动进度、暂停清零、本地文件导入，并输出截图与 JSON 报告。正常启动不会运行测试。
