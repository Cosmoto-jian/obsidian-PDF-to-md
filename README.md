# PDF to MD · Obsidian Plugin

> Convert any PDF to Markdown with one click, with a custom filename — right inside Obsidian.

**Language · 语言** &nbsp; `English` &nbsp;·&nbsp; [**切换至中文版 →**](#中文版)

---

## Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [How to Use](#how-to-use)
4. [Interface Guide](#interface-guide)
5. [Notes](#notes)

---

## Introduction

**PDF to MD** is a lightweight Obsidian plugin that lets you convert any `.pdf` file in your vault directly to Markdown — without leaving Obsidian, and without any complex folder configuration.

| | Details |
|---|---|
| **Trigger** | Right-click any PDF in the file explorer |
| **Filename** | Editable output filename before converting |
| **Output location** | Vault root or an optional output folder |
| **Conversion engine** | `@opendataloader/pdf` |
| **Platform** | Desktop only |

---

## Installation

### Step 1 — Install the conversion library

Open a terminal, navigate to the plugin directory, and run:

```bash
npm install @opendataloader/pdf
```

### Step 2 — Build the plugin

```bash
npm install      # Install all dependencies
npm run build    # Compile and generate main.js
```

### Step 3 — Place plugin files

Copy these three files into your vault's plugin folder:

```
<Your Vault>/.obsidian/plugins/pdf-to-md/
├── main.js            ← compiled output
├── manifest.json      ← plugin metadata
├── styles.css         ← UI styles
└── node_modules/      ← contains @opendataloader/pdf
```

### Step 4 — Enable the plugin

Open Obsidian, go to:

```
Settings → Community plugins → Find "PDF to MD" → Enable
```

---

## How to Use

### Method 1 — Right-click menu (recommended)

1. In the left file explorer, locate any `.pdf` file
2. **Right-click** the file
3. Click **"Convert to Markdown"** in the context menu
4. A dialog appears — confirm or edit the filename, then click **Convert**

```
File Explorer
│
├── 📁 Notes
├── 📄 research.pdf      ← Right-click this file
│       │
│       └── [Context Menu]
│              ├── Open
│              ├── Rename
│              ├── Delete
│              └── ✅ Convert to Markdown   ← Click
```

### Method 2 — Command palette

1. Open a PDF file in Obsidian so it becomes the active file
2. Open the command palette:
   - **Windows / Linux:** `Ctrl + P`
   - **macOS:** `Cmd + P`
3. Search and run: **"Convert active PDF to Markdown"**

---

## Conversion Modes

The plugin intentionally exposes two top-level modes. This keeps the UI aligned with the actual upstream execution paths: local Java conversion, or hybrid backend conversion. OCR and formula enrichment are handled by Hybrid mode.

| Mode | Best for | Backend command |
|---|---|---|
| Fast | Standard digital PDFs, quick local conversion | None |
| Hybrid | Complex layouts and tables through the OpenDataLoader hybrid backend | Auto-starts `/opt/anaconda3/bin/opendataloader-pdf-hybrid` |

Hybrid enhancements change the backend command:

| Enhancement | Backend flag | Client behavior |
|---|---|---|
| OCR | `--force-ocr --ocr-lang "ch_sim,en"` | Keeps `--hybrid docling-fast` |
| Formulas | `--enrich-formula` | Uses `--hybrid-mode full` |
| Pictures | `--no-enrich-picture-description` | Exports images without VLM-generated descriptions |

Hybrid mode requires the upstream Python hybrid package:

```bash
pip install -U "opendataloader-pdf[hybrid]"
```

When Hybrid is selected, the plugin starts the conda backend automatically on `http://127.0.0.1:5002` with OCR and formula enrichment enabled. Picture descriptions are disabled so no vision-language model is loaded.

Plugin settings let you choose the default conversion mode, hybrid backend URL, hybrid timeout, and fallback behavior. Fallback is off by default so backend failures are visible.

Before conversion, the plugin waits until the configured backend URL is reachable.

---

## Interface Guide

The conversion dialog has five sections:

```
┌─────────────────────────────────────────┐
│  [📄]  Source                           │  ← Header
│        research.pdf                     │     Shows source PDF filename
│─────────────────────────────────────────│
│                                         │
│  SAVE AS                                │  ← Filename field
│  ┌──────────────────────┬──────┐        │     Pre-filled with PDF basename
│  │  my-research-notes   │ .md  │        │     Fully editable
│  └──────────────────────┴──────┘        │
│                                         │
│  ○ Ready                                │  ← Status bar
│                                         │     Real-time feedback
│─────────────────────────────────────────│
│  [    Convert    ]  [    Cancel    ]    │  ← Action buttons
└─────────────────────────────────────────┘
```

### Status bar states

| Status | Color | Meaning |
|---|---|---|
| `Ready` | Gray | Waiting for action |
| `Converting…` | Blue + spinner | Conversion in progress |
| `Saved as xxx.md` | Green | Success — window closing shortly |
| Error message | Red | Failed — click Retry to try again |

### Filename rules

- Supports letters, numbers, spaces, hyphens, underscores, and CJK characters
- Cannot contain: `/ \ : * ? " < > |`
- The `.md` extension is added automatically — do not type it yourself
- Pressing `Enter` is equivalent to clicking Convert

---

## Notes

**Output location**
Converted `.md` files are saved to the **vault root directory** by default. Use the optional output folder field to save into a vault-relative folder.

**Re-converting**
If you convert with the same output filename again, the existing `.md` file will be overwritten. Back up any manually edited content beforehand.

**Desktop only**
This plugin depends on Node.js `fs` / `path` modules and the Electron runtime. **iOS and Android are not supported.**

**Conversion quality**

| PDF Type | Quality |
|---|---|
| Standard digital PDF | ⭐⭐⭐⭐⭐ Excellent |
| Complex / nested tables | ⭐⭐⭐⭐⭐ Best with Hybrid |
| Scanned / image-based | Depends on the external backend configuration |

---
---

# 中文版

> 在 Obsidian 中一键将任意 PDF 转化为 Markdown，支持自定义文件名。

**Language · 语言** &nbsp; [**Switch to English ↑**](#pdf-to-md--obsidian-plugin) &nbsp;·&nbsp; `中文`

---

## 目录

1. [简介](#简介)
2. [安装](#安装)
3. [使用方式](#使用方式)
4. [界面说明](#界面说明)
5. [注意事项](#注意事项)

---

## 简介

**PDF to MD** 是一个轻量级 Obsidian 插件，让你在 Vault 中直接对任意 `.pdf` 文件执行转化操作，无需离开 Obsidian，无需配置复杂的路径规则。

| | 详情 |
|---|---|
| **触发方式** | 在文件树中右键任意 PDF 文件 |
| **文件名** | 转化前可自定义输出文件名 |
| **保存位置** | Vault 根目录，或自定义输出文件夹 |
| **转化引擎** | `@opendataloader/pdf` |
| **运行环境** | 仅支持桌面端 |

---

## 安装

### 第一步：安装转化依赖

在终端中进入插件目录，执行：

```bash
npm install @opendataloader/pdf
```

### 第二步：编译插件

```bash
npm install      # 安装所有依赖
npm run build    # 编译，生成 main.js
```

### 第三步：放置文件

将以下三个文件复制到你的 Vault 插件目录：

```
<Your Vault>/.obsidian/plugins/pdf-to-md/
├── main.js            ← 编译产物
├── manifest.json      ← 插件元数据
├── styles.css         ← 界面样式
└── node_modules/      ← 包含 @opendataloader/pdf
```

### 第四步：启用插件

打开 Obsidian，前往：

```
设置 Settings → 第三方插件 Community plugins → 找到 PDF to MD → 启用 Enable
```

---

## 使用方式

### 方法一：右键菜单（推荐）

1. 在左侧文件树中，找到任意一个 `.pdf` 文件
2. **右键单击**该文件
3. 在弹出菜单中点击 **"Convert to Markdown"**
4. 弹出转化窗口，确认或修改文件名后点击 **Convert**

```
文件树 File Explorer
│
├── 📁 笔记
├── 📄 research.pdf      ← 右键此文件
│       │
│       └── [右键菜单]
│              ├── 打开
│              ├── 重命名
│              ├── 删除
│              └── ✅ Convert to Markdown   ← 点击
```

### 方法二：命令面板

1. 先在 Obsidian 中打开一个 PDF 文件，使其成为当前活动文件
2. 按下快捷键打开命令面板：
   - **Windows / Linux：** `Ctrl + P`
   - **macOS：** `Cmd + P`
3. 搜索并执行：**"Convert active PDF to Markdown"**

---

## 转换模式

插件只暴露两个顶层模式。这样 UI 和上游实际执行路径保持一致：要么本地 Java 转换，要么走 hybrid 后端转换。OCR 和公式增强由 Hybrid 模式统一处理。

| 模式 | 适用场景 | 后端启动命令 |
|---|---|---|
| Fast | 标准数字 PDF，快速本地转换 | 无需后端 |
| Hybrid | 复杂排版、复杂表格，走 OpenDataLoader hybrid 后端 | 自动启动 `/opt/anaconda3/bin/opendataloader-pdf-hybrid` |

Hybrid 增强项会改变后端启动命令：

| 增强项 | 后端参数 | 客户端行为 |
|---|---|---|
| OCR | `--force-ocr --ocr-lang "ch_sim,en"` | 保持 `--hybrid docling-fast` |
| 公式 | `--enrich-formula` | 使用 `--hybrid-mode full` |
| 图片 | `--no-enrich-picture-description` | 导出图片，但不调用视觉语言模型生成描述 |

Hybrid 模式需要安装上游 Python hybrid 包：

```bash
pip install -U "opendataloader-pdf[hybrid]"
```

选择 Hybrid 时，插件会自动在 `http://127.0.0.1:5002` 启动 conda 后端，并启用 OCR 和公式增强。图片描述已关闭，因此不会加载视觉语言模型。

插件设置中可以调整默认转换模式、Hybrid 后端 URL、Hybrid 超时时间和 fallback 行为。Fallback 默认关闭，避免后端不可用时静默退回本地转换。

正式转换前，插件会等待配置的后端 URL 可访问。

---

## 界面说明

转化弹窗由五个区域组成：

```
┌─────────────────────────────────────────┐
│  [📄]  Source                           │  ← 顶部标题区
│        research.pdf                     │     显示源 PDF 文件名
│─────────────────────────────────────────│
│                                         │
│  SAVE AS                                │  ← 文件名输入区
│  ┌──────────────────────┬──────┐        │     预填充 PDF 文件名
│  │  my-research-notes   │ .md  │        │     可直接修改
│  └──────────────────────┴──────┘        │
│                                         │
│  ○ 准备就绪                             │  ← 状态栏
│                                         │     实时反馈转化进度
│─────────────────────────────────────────│
│  [    Convert    ]  [    Cancel    ]    │  ← 操作按钮
└─────────────────────────────────────────┘
```

### 状态栏说明

| 状态 | 颜色 | 含义 |
|---|---|---|
| `Ready` | 灰色 | 准备就绪，等待操作 |
| `Converting…` | 蓝色 + 旋转图标 | 正在转化中 |
| `Saved as xxx.md` | 绿色 | 转化成功，窗口即将关闭 |
| 错误信息 | 红色 | 转化失败，可点 Retry 重试 |

### 文件名输入规则

- 支持中文、英文、数字、空格、连字符、下划线
- 不可包含以下字符：`/ \ : * ? " < > |`
- 扩展名 `.md` 自动添加，无需手动输入
- 按 `Enter` 键与点击 Convert 按钮效果相同

---

## 注意事项

**输出位置**
转化完成的 `.md` 文件默认保存在 **Vault 根目录**。如果填写输出文件夹，则会保存到对应的 Vault 相对路径。

**重复转化**
若对同一文件名再次执行转化，已有的 `.md` 文件将被直接覆盖。请注意提前备份已手动编辑的内容。

**仅支持桌面端**
该插件依赖 Node.js 的 `fs` 和 `path` 模块以及 Electron 环境，**不支持移动端（iOS / Android）**。

**转化质量参考**

| PDF 类型 | 转化效果 |
|---|---|
| 标准数字 PDF | ⭐⭐⭐⭐⭐ 优秀 |
| 含复杂 / 嵌套表格 | ⭐⭐⭐⭐⭐ 建议使用 Hybrid |
| 扫描件 / 图像型 PDF | 取决于外部后端配置 |

---

*PDF to MD · v2.0.0 · Desktop Only · Powered by @opendataloader/pdf*
