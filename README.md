上游 Joplin 3.7.22 的说明见 [官方 README](https://github.com/laurent22/joplin/blob/v3.7.22/README.md)。

# Joplin for macOS M2

这个仓库是 [Joplin](https://github.com/laurent22/joplin) `v3.7.22`（`95cab5a86d770c57f58fd43953f37a2cfe5a7016`）的桌面端分支，默认只为 **Apple M2 / arm64 / macOS 15.7.7** 编译和调校。目标是装出来的应用体积小、启动快、滚动和输入顺滑，视觉跟这台 Mac 的系统界面一致。

许可证仍是上游的 AGPL-3.0-or-later。

直接下载已编译的 Apple Silicon 安装包：[releases/Joplin-3.7.22-arm64.dmg](https://github.com/gangjian0917/joplin/raw/main/releases/Joplin-3.7.22-arm64.dmg)（2026-11-18 构建）。同目录另有带日期的副本 [Joplin-3.7.22-20261118-arm64.dmg](https://github.com/gangjian0917/joplin/raw/main/releases/Joplin-3.7.22-20261118-arm64.dmg)。

## 项目目标

- 安装包只含 `mac-arm64`，Electron 和原生模块都按 arm64 打包。
- 界面使用 macOS 15 的系统字体和字号，不再加载 Roboto。
- 打包时去掉这台机器不会执行的运行时、语言包和调试文件。
- 应用 ID 保持 `net.cozic.joplin-desktop`，可以直接替换官网安装的 `/Applications/Joplin.app`。笔记、WebDAV 同步和插件仍在 `~/Library/Application Support/Joplin`。

## 已做的改动

### 界面

- 正文字体：`-apple-system`（SF Pro，中文走苹方）。
- 等宽字体：`ui-monospace` / SF Mono。
- 字号：界面 13px，正文 16px，笔记标题 22px，次要文字 11px。
- 侧栏和笔记列表使用 macOS 的圆角选中样式。
- 文字抗锯齿改为 `-webkit-font-smoothing: antialiased`。
- 打包前重新编译样式。原先编进包里的 `style.min.css` 仍给每个 `div`、`span`、`a` 指定 Roboto。

### 体积

2026-11-18 在这台 M2 上重新打包（主页下载链接对应该构建）：

| 产物 | 优化前 | 优化后 |
| --- | --- | --- |
| `Joplin.app` | 584MB | 350MB |
| `Joplin-3.7.22-arm64.dmg` | 201MB | 123MB |
| `app.asar` | 221MB | 72MB |

打包时排除：

- `onnxruntime-web` 的网页 WASM。本地嵌入仍用 `onnxruntime-node` 的 arm64 库。
- Tesseract 里用不到的 WASM。Apple Silicon 只保留 LSTM 的 relaxed-SIMD 和 SIMD 两份。
- Chromium 除 `en`、`zh_CN`、`zh_TW` 以外的 `.lproj`。Joplin 自己的界面语言包保留。
- source map、sqlite 源码包、测试目录、Roboto 网页字体，以及 Font Awesome 的 svg / eot / ttf / woff。图标使用 woff2。

macOS 产物是 arm64 的 dmg 和 zip。本机没有 Apple 签名身份，打出来的包不签名、不公证。

### 实测效果

在同一台 MacBook Air（Apple M2，macOS 15.7.7）上，相对官网 3.7.22 安装包：

- 整体操作明显更快，界面更跟手。
- 点击笔记列表后，正文几乎瞬间渲染出来，切换笔记不再有可感知的停顿。

主要原因是安装包更轻（去掉网页版 ONNX、多余 OCR 内核和语言包等），界面改用系统字体后不再加载 Roboto 网页字体。

## 编译环境

完整工具链和替换已安装应用的步骤见 [BUILD-ENV.md](BUILD-ENV.md)。

| 项 | 值 |
| --- | --- |
| 机器 | MacBook Air，Apple M2 |
| 系统 | macOS 15.7.7（Build 24G720） |
| 架构 | arm64 |
| Node.js | 26.13.0（Homebrew，arm64）。仓库要求 `>=22.12` |
| Yarn | 4.16.0，由根目录 `packageManager` 锁定 |
| Python | 3.15.2，给 node-gyp 和 `canvas` 用 |
| pango | 1.58.2，`brew install pango pkg-config` |
| Electron | 42.11.18 |

编译：

```bash
/Users/meizu/github/joplin/build-joplin.sh
```

脚本会安装缺失依赖、按 arm64 打包、关闭签名，并把结果覆盖写到仓库根目录：

```text
/Users/meizu/github/joplin                         源码和编译脚本
/Users/meizu/github/joplin/Joplin.app              应用
/Users/meizu/github/joplin/Joplin-<version>-arm64.dmg  安装镜像
```

开发时不打包，在 `packages/app-desktop` 里执行 `yarn start`。

未签名的包第一次打开前执行：

```bash
xattr -cr /Users/meizu/github/joplin/Joplin.app
```
