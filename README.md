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
| **Output location** | Auto-saved to vault root |
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
└── styles/
    └── styles.css     ← UI styles
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

## Interface Guide

The conversion dialog has four sections:

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
All converted `.md` files are saved to the **vault root directory**, regardless of which subfolder the source PDF was in.

**Re-converting**
If you convert with the same output filename again, the existing `.md` file will be overwritten. Back up any manually edited content beforehand.

**Desktop only**
This plugin depends on Node.js `fs` / `path` modules and the Electron runtime. **iOS and Android are not supported.**

**Conversion quality**

| PDF Type | Quality |
|---|---|
| Standard digital PDF | ⭐⭐⭐⭐⭐ Excellent |
| Complex / nested tables | ⭐⭐⭐⭐ Good |
| Scanned / image-based | ⭐⭐⭐ Fair — OCR mode recommended |

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
| **保存位置** | 自动保存到 Vault 根目录 |
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
└── styles/
    └── styles.css     ← 界面样式
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

## 界面说明

转化弹窗由四个区域组成：

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
转化完成的 `.md` 文件统一保存在 **Vault 根目录**，不会跟随原 PDF 所在的子文件夹位置。

**重复转化**
若对同一文件名再次执行转化，已有的 `.md` 文件将被直接覆盖。请注意提前备份已手动编辑的内容。

**仅支持桌面端**
该插件依赖 Node.js 的 `fs` 和 `path` 模块以及 Electron 环境，**不支持移动端（iOS / Android）**。

**转化质量参考**

| PDF 类型 | 转化效果 |
|---|---|
| 标准数字 PDF | ⭐⭐⭐⭐⭐ 优秀 |
| 含复杂 / 嵌套表格 | ⭐⭐⭐⭐ 良好 |
| 扫描件 / 图像型 PDF | ⭐⭐⭐ 一般，建议搭配 OCR 模式使用 |

---

*PDF to MD · v1.0.0 · Desktop Only · Powered by @opendataloader/pdf*
