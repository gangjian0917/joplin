# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 本仓库定位

- 上游 [Joplin](https://github.com/laurent22/joplin) `v3.7.22`（commit `95cab5a…`）的桌面端 fork，浅克隆：git 历史只有这一个标签，往上查不到更早记录。
- **只为 Apple M2 / arm64 / macOS 15.7.7 编译和调校**。Windows、Linux、x64、移动端不是本 fork 的目标，相关包原样保留但不要花精力。打出的包不签名、不公证，首次打开前需 `xattr -cr <path>/Joplin.app`。
- fork 的改动集中在三处：字体视觉（`packages/lib/theme.ts` 按 `shim.isMac()` 分支、新增的 `packages/lib/themes/macos.ts`、`packages/app-desktop/gui/**` 各样式、`packages/renderer/noteStyle.ts`、`packages/editor/CodeMirror/theme.ts`）；体积裁剪（`packages/app-desktop/package.json` 的 `build.files` / `electronLanguages`、`tools/copyApplicationAssets.js`）；编译脚本 `build-joplin.sh`。
- 应用 ID 保持 `net.cozic.joplin-desktop`；笔记、同步、插件数据在 `~/Library/Application Support/Joplin`，替换 `/Applications/Joplin.app` 不影响数据。`releases/` 目录存放已发布的 dmg。

## 常用命令

先在仓库根目录 `yarn install`（同时安装 husky pre-commit 钩子）。

| 任务 | 命令 |
| --- | --- |
| 打 arm64 安装包 | 仓库根目录 `bash build-joplin.sh`，产物 `Joplin.app` 和 dmg 覆盖写到仓库根目录 |
| 开发运行桌面端 | `cd packages/app-desktop && yarn start` |
| 持续编译 TS | 根目录 `yarn watch`（一次性编译用 `yarn tsc`） |
| 只做类型检查 | 在具体包里 `yarn tsc --noEmit` |
| Lint | 根目录 `yarn linter`（= eslint --fix；不加 fix 用 `yarn linter-ci`） |
| 跑某个包的全部测试 | `cd packages/lib && yarn test` |
| 跑单个测试 | `cd packages/lib && yarn test ArrayUtils`（jest 按文件路径模式匹配） |
| 拼写检查 | `yarn spellcheck <file>` |

关键坑：

- **TS 编译产物 `.js` 生成在 `.ts` 旁边**，应用运行和大部分测试吃的都是编译后的 js。`packages/lib` 的 jest 只匹配 `**/*.test.js`——改完 `.ts` 必须先 `yarn tsc`（或开着 `yarn watch`）再跑测试，否则测的是旧代码。（`app-desktop` 的 jest 匹配 `*.test.ts`，直接跑源码。）
- 新增 `.ts` 文件后在根目录跑 `yarn updateIgnored`，把编译产物加进 ignore 列表。
- `build-joplin.sh` 运行期间会临时改写 `packages/app-desktop/package.json`（mac 目标改成 arm64 dmg+zip、去掉签名），退出时还原。脚本运行时不要手工编辑该文件。
- 仓库要求 Node >= 22.12、Yarn 4.16（根目录 `packageManager` 锁定）；本机还需 `brew install pango pkg-config`（`canvas` 编译依赖）。项目路径不能含空格。

## 架构

Yarn workspaces + Lerna 管理的 monorepo，`packages/*` 下所有应用共享同一套后端：

- **`packages/lib` — 核心业务库**，桌面/移动/CLI 共用：`services/`（同步、搜索、插件、E2EE、REST API 等几乎所有业务逻辑）、`models/`（数据库层，**SQL 只允许出现在 models 里**）、`reducer.ts`（Redux 状态树，桌面和移动共用）、`shim.ts` + `shim-init-*.ts`（Node / React Native / 浏览器的平台抽象层）。
- **`packages/app-desktop`** — Electron + React + Redux。主进程入口 `ElectronAppWrapper.ts`，UI 在 `gui/`。
- **`packages/renderer`** — Markdown → HTML 渲染管线；**`packages/editor`** — CodeMirror 编辑器封装。
- 其余：`app-mobile`（React Native）、`app-cli`、`server`、`tools`（构建工具链）、`utils`，以及若干 `fork-*`（上游自己 fork 的第三方库）。

各应用结构统一：前端（每个应用用不同框架）+ 共享后端（services + models + 本地 SQLite）。

## 编码风格

- 缩进用 Tab，字符串用单引号；写严谨的 TypeScript 类型，避免 `any`。
- TypeScript 能推断类型时不要标注返回类型/常量类型，仅当会推断成 `any` 时才标注。
- 注释只用 `//`，不用 jsdoc 语法。默认不写注释，只在"为什么"不明显时（绕坑、隐藏约束、隐蔽不变量）加一两行；不要解释代码做了什么。
- 复制大段代码时，在副本上方加注释标明复制来源位置。
- 不做纯空白改动：不加多余空行、空格，不重排既有代码。
- Jest 测试文件里只能有一个 `describe()`；同一逻辑不同输入用 `test.each` 或共享 helper，避免复制相似测试块；聚焦关键行为和边界，不为琐碎细节逐条加测试。
- 出现 cSpell 未识别词时，按 `readme/dev/spellcheck.md` 处理（加进 `packages/tools/cspell/dictionary*.txt` 词表，或用 disable 注释）。
- Markdown 文件不要硬换行，整段交给渲染器换行。
- 数据库表名、列名用 snake_case。
- 完整规范（命名、import、XSS 转义、React、数据库、测试）见 `readme/dev/coding_style.md`，改代码前值得通读。

## 桌面端样式

- 用 RSCSS + SCSS：组件样式放各自目录的 `style.scss`，并在 `packages/app-desktop/style.scss` 里引用；全局样式进 `main.scss`。构建时编译出最终的 `style.css`。规则细节见 `readme/dev/spec/desktop_styling.md`。
- 禁止 inline `style={{...}}` 和 styled-components；inline style 仅限真正按实例动态计算的值（宽度、位置）。主题色一律用 `var(--joplin-*)` CSS 变量，不要在 JS 里读主题。
- macOS 的字体/字号常量集中在 `packages/lib/themes/macos.ts`（`macosFontFamily`、`macosUiFontSize`、`macosBodyFontSize`、`macosSecondaryFontSize` 等），`packages/lib/theme.ts` 里按 `shim.isMac()` 分支取值。界面调优优先改这两处，不要把数值散落进各组件。
- 正文字体走 `-apple-system`，等宽走 `ui-monospace`，不再加载 Roboto 网页字体（打包时已排除）。

## 文档

- 编译环境与替换已装应用的完整步骤：`BUILD-ENV.md`；本 fork 的说明：`README.md`。
- 技术规格（同步、插件、E2EE、性能等）：`readme/dev/spec/`。
