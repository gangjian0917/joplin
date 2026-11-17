# 本机编译环境

这份说明记录在这台 Mac 上编译 Joplin 桌面版的环境。源码树对应官网客户端 **3.7.22**，修订 `95cab5a86d770c57f58fd43953f37a2cfe5a7016`（标签 `v3.7.22`）。

本地检出是这个标签的浅克隆，仓库里没有更早的上游历史。

## 机器

| 项 | 值 |
| --- | --- |
| 机器 | MacBook Air，Apple M2 |
| 架构 | arm64 |
| 系统 | macOS 15.7.7（Build 24G720） |
| 命令行工具 | Xcode Command Line Tools，`/Library/Developer/CommandLineTools` |
| 代码签名 | 本机没有可用的 Apple 签名身份。打出来的包不签名、不公证 |

## 工具链

| 项 | 本机实际版本 | 说明 |
| --- | --- | --- |
| Node.js | 26.13.0 | Homebrew，`/opt/homebrew/bin/node`，二进制是 arm64。仓库要求 `>=22.12`。官方 macOS arm64 CI 使用 Node 24 |
| corepack | 0.36.0 | Node 26 不再自带 corepack。装在 `~/.local`，只放了 Yarn 入口，避免覆盖本机已有的 pnpm |
| Yarn | 4.16.0 | 由根目录 `packageManager` 锁定，程序在 `.yarn/releases/yarn-4.16.0.cjs` |
| Python | 3.15.2 | 给 node-gyp、`canvas` 用。官方 CI 使用 Python 3.14 |
| pango | 1.58.2 | `brew install pango pkg-config`。`canvas` 需要 `pangocairo` |
| Electron | 42.11.18 | `packages/app-desktop` 里锁定的版本 |

确认 Yarn：

```bash
corepack enable yarn --install-directory "$HOME/.local/bin"
cd /Users/meizu/github/joplin
yarn --version
```

## 编译

仓库根目录的 `build-joplin.sh` 会安装缺失依赖、把 macOS 目标临时改成 arm64、关闭签名，然后执行 `yarn dist --mac --arm64 --publish=never`。`packages/app-desktop/package.json` 在脚本退出时还原。

本机目录约定：

```text
/Users/meizu/github/joplin          源码
/Users/meizu/github/build-joplin.sh 转到仓库里的脚本
/Users/meizu/github/Joplin.app      编译结果
```

执行：

```bash
/Users/meizu/github/build-joplin.sh
```

脚本把 `Joplin.app` 放到源码目录的上一级，并在同一位置复制 `Joplin-<version>-arm64.dmg`。

开发版不打包，在 `packages/app-desktop` 里执行 `yarn start`。

## 替换已安装的官网应用

应用 ID 仍是 `net.cozic.joplin-desktop`。笔记、WebDAV 同步和已安装插件在 `~/Library/Application Support/Joplin`，替换 `/Applications/Joplin.app` 不会清掉这些数据。

未签名的包第一次打开前执行：

```bash
xattr -cr /Users/meizu/github/Joplin.app
```

若系统仍拦截，到「系统设置 → 隐私与安全性」里允许打开。
