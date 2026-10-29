# dsh-pet-sound

[![CI](https://github.com/LY3LY333/dsh-pet-sound/actions/workflows/ci.yml/badge.svg)](https://github.com/LY3LY333/dsh-pet-sound/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%E2%89%A518.17-brightgreen.svg)](package.json)

给 **DSH 桌面桌宠（dsh-pet）** 加上点击音效的小工具。幂等、可回滚、不改任何 DSH 配置。

> A tiny, idempotent patcher that gives the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) desktop pet (`dsh-pet`) a soft click sound — no asset files, no DSH config changes, fully reversible.

---

## 为什么需要它

`dsh-pet` 的点击回应是一段 **无声的 webm 动画**：源码里没有任何音频调用，素材也没有音轨。想让桌宠"戳一下有反应声"，只能改它的渲染层。

这个工具把那点改动做成 **可重复、可撤销** 的操作，而不是手改 `node_modules`。

## 特性

| 能力 | 说明 |
|---|---|
| **幂等** | 重复 `apply` 不会叠加，第二次直接返回 `already-patched` |
| **可回滚** | `revert` 精确删除注入块，测试保证**逐字节还原**原文件 |
| **自动备份** | 每次写入前生成 `sprite.js.dsh-pet-sound.<时间戳>.bak` |
| **外部补丁检测** | 检测到已有其它音效钩子时**拒绝执行**（避免叠成两声），需 `--force` 才覆盖 |
| **零依赖** | 只用 Node 内置模块 + Web Audio API，不需要安装任何包 |
| **多 profile** | 自动扫描 `$DSH_HOME/profiles/*`，也可 `--profile` 指定 |
| **可脚本化** | `--dry-run` 预演、`--json` 机器可读输出 |

## 安装

```bash
git clone https://github.com/LY3LY333/dsh-pet-sound.git
cd dsh-pet-sound
```

要求 Node.js ≥ 18.17，零第三方依赖。（尚未发布到 npm，所以请用下面的本地命令。）

## 使用

下文的 `dsh-pet-sound` 都指 `node bin/dsh-pet-sound.js`，也可以先 `npm link` 再直接用命令名。

```bash
# 查看状态（不写入任何东西）
node bin/dsh-pet-sound.js status

# 打补丁（默认音量 0.16）
node bin/dsh-pet-sound.js apply

# 自定义音量（0 < v <= 1）
node bin/dsh-pet-sound.js apply --volume 0.1

# 只预演，不写文件
node bin/dsh-pet-sound.js apply --dry-run

# 撤销
node bin/dsh-pet-sound.js revert
```

打完补丁后 **重启桌宠** 才会生效（右键桌宠 → 重载配置，或重启 DSH）。

指定 profile：

```bash
node bin/dsh-pet-sound.js apply --profile "C:\Users\you\.dsh\profiles\desktop"
```

### 输出示例

```text
$ dsh-pet-sound status
PROFILE             PET       STATE       FILE
desktop             0.3.8     clean       C:\Users\you\.dsh\profiles\desktop\node_modules\dsh-pet\runtime\electron-helper\sprite.js

$ dsh-pet-sound apply
✓ desktop: patched — restart dsh-pet to hear it
  backup: C:\Users\you\.dsh\profiles\desktop\node_modules\dsh-pet\runtime\electron-helper\sprite.js.dsh-pet-sound.2026-10-27T14-00-00-000Z.bak
```

## 实现原理

只做两处字符串插入（源码可见 [`src/patch.js`](src/patch.js)）：

1. 在 `'use strict'` 之后插入一个 `__dshPetSound()` 函数（Web Audio 合成"叮咚"，带标记注释）
2. 在 `onClick(e) {` 之后插入一行 `__dshPetSound(); // dsh-pet-sound`

`revert` 按标记删除这两处。整个过程不碰 DSH 的 profile 配置、锁文件或其它插件。

## 兼容性

| 项目 | 版本 |
|---|---|
| dsh-pet | **0.3.x**（在 0.3.8 上验证） |
| DSH Desktop | 0.2.x |
| Node.js | ≥ 18.17 |

> 只作用于**桌面模式**（`runtime/electron-helper/sprite.js`）。浏览器里的网页版桌宠不走这个文件。

## 已知限制

- **dsh-pet 升级会覆盖补丁** —— 升级后重新 `apply` 即可。
- 锚点依赖 `onClick(e) {` 这一行；上游若改写法会返回 `anchor-not-found` 而不是乱改文件。
- 音效是纯合成音（正弦波 880→1318 Hz），没有内置素材；想换音色改 [`src/snippet.js`](src/snippet.js) 即可。

## 开发

```bash
node --test        # 10 个测试：幂等、回滚、CRLF、外部补丁检测…
npm run lint       # 三个入口文件的语法检查
```

## License

MIT © 2026 六月风
