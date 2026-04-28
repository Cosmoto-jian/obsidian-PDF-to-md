var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => PdfToMdPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var path = __toESM(require("path"));
var fs = __toESM(require("fs"));
var import_child_process = require("child_process");
var JavaNotFoundError = class extends Error {
  constructor() {
    super(
      "Java Runtime Environment (JRE) is required but not found.\n\nPlease install Java from:\n\u2022 macOS: brew install openjdk\n\u2022 Or download from: https://www.java.com/download/"
    );
    this.name = "JavaNotFoundError";
  }
};
var JarNotFoundError = class extends Error {
  constructor(candidates) {
    super(
      `JAR file not found. Please run "npm install @opendataloader/pdf" in the plugin folder.

Checked:
${candidates.join("\n")}`
    );
    this.name = "JarNotFoundError";
  }
};
var HybridBackendError = class extends Error {
  constructor(url, detail) {
    super(`Hybrid backend is not reachable at ${url}${detail ? `: ${detail}` : ""}`);
    this.name = "HybridBackendError";
  }
};
var PdfToMdPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "pluginDir", "");
    __publicField(this, "settings");
  }
  async onload() {
    await this.loadSettings();
    this.pluginDir = getPluginDir(this.app, this.manifest);
    this.addSettingTab(new PdfToMdSettingTab(this.app, this));
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof import_obsidian.TFile) || file.extension.toLowerCase() !== "pdf")
          return;
        menu.addItem(
          (item) => item.setTitle("Convert to Markdown").setIcon("file-text").onClick(() => new ConvertModal(this.app, file, this.pluginDir, this.settings, () => this.saveSettings()).open())
        );
      })
    );
    this.addCommand({
      id: "convert-active-pdf",
      name: "Convert active PDF to Markdown",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if ((file == null ? void 0 : file.extension.toLowerCase()) === "pdf") {
          if (!checking)
            new ConvertModal(this.app, file, this.pluginDir, this.settings, () => this.saveSettings()).open();
          return true;
        }
        return false;
      }
    });
    this.registerEvent(
      this.app.workspace.on("files-menu", (menu, files) => {
        const pdfFiles = files.filter((f) => f instanceof import_obsidian.TFile && f.extension.toLowerCase() === "pdf");
        if (pdfFiles.length === 0)
          return;
        if (pdfFiles.length > 1) {
          menu.addItem(
            (item) => item.setTitle("Convert to Markdown (select one)").setIcon("file-text").setDisabled(true)
          );
          return;
        }
        const pdfFile = pdfFiles[0];
        menu.addItem(
          (item) => item.setTitle("Convert to Markdown").setIcon("file-text").onClick(() => new ConvertModal(this.app, pdfFile, this.pluginDir, this.settings, () => this.saveSettings()).open())
        );
      })
    );
  }
  async loadSettings() {
    this.settings = normalizeSettings(Object.assign({}, DEFAULT_SETTINGS, await this.loadData()));
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
};
var DEFAULT_SETTINGS = {
  defaultMode: "fast",
  hybridUrl: "http://localhost:5002",
  hybridTimeout: "0",
  hybridFallback: true,
  lastOutputFolder: "",
  lastImageFolder: ""
};
var CONVERSION_MODES = [
  {
    id: "fast",
    name: "Fast",
    description: "Java-only conversion for standard digital PDFs. No backend required.",
    options: {
      format: "markdown",
      hybrid: "off",
      imageOutput: "off",
      keepLineBreaks: true,
      tableMethod: "cluster",
      useStructTree: true
    }
  },
  {
    id: "hybrid",
    name: "Hybrid",
    description: "Uses the hybrid backend for OCR, formulas, and complex layouts.",
    options: {
      format: "markdown",
      hybrid: "docling-fast",
      hybridMode: "full",
      imageOutput: "external",
      tableMethod: "cluster",
      useStructTree: true
    },
    requiresHybrid: true
  }
];
function getMode(id) {
  return CONVERSION_MODES.find((mode) => mode.id === id) || CONVERSION_MODES[0];
}
function normalizeSettings(settings) {
  if (!CONVERSION_MODES.some((mode) => mode.id === settings.defaultMode)) {
    settings.defaultMode = DEFAULT_SETTINGS.defaultMode;
  }
  if (!settings.hybridUrl)
    settings.hybridUrl = DEFAULT_SETTINGS.hybridUrl;
  if (!settings.hybridTimeout)
    settings.hybridTimeout = DEFAULT_SETTINGS.hybridTimeout;
  return settings;
}
function getHybridPort(settings) {
  try {
    return new URL(settings.hybridUrl).port || "5002";
  } catch (e) {
    return "5002";
  }
}
function getHybridServerCommand(mode, settings) {
  if (!mode.requiresHybrid)
    return null;
  return `opendataloader-pdf-hybrid --port ${getHybridPort(settings)}`;
}
function getConversionOptions(mode, settings, outputDir) {
  const opts = { ...mode.options, outputDir, quiet: false };
  if (mode.requiresHybrid) {
    opts.hybridUrl = settings.hybridUrl;
    opts.hybridTimeout = settings.hybridTimeout;
    opts.hybridFallback = settings.hybridFallback;
  }
  return opts;
}
function checkJavaAvailable() {
  return new Promise((resolve, reject) => {
    const proc = (0, import_child_process.spawn)("java", ["-version"], { stdio: "pipe" });
    proc.on("close", (code) => {
      if (code === 0)
        resolve();
      else
        reject(new JavaNotFoundError());
    });
    proc.on("error", () => reject(new JavaNotFoundError()));
  });
}
async function assertHybridBackendAvailable(settings) {
  const timeoutMs = parseInt(settings.hybridTimeout, 10);
  const effectiveTimeout = timeoutMs > 0 ? timeoutMs : 5e3;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), effectiveTimeout);
  try {
    const healthUrl = settings.hybridUrl.replace(/\/+$/, "") + "/health";
    const response = await fetch(healthUrl, { method: "GET", signal: controller.signal });
    if (!response.ok)
      throw new HybridBackendError(settings.hybridUrl, `HTTP ${response.status}`);
  } catch (e) {
    if (e instanceof HybridBackendError)
      throw e;
    throw new HybridBackendError(settings.hybridUrl);
  } finally {
    window.clearTimeout(timer);
  }
}
var JAR_NAME = "opendataloader-pdf-cli.jar";
function getVaultPath(app) {
  const adapter = app.vault.adapter;
  if (adapter.basePath && typeof adapter.basePath === "string")
    return adapter.basePath;
  if (adapter.getBasePath && typeof adapter.getBasePath === "function")
    return adapter.getBasePath();
  return process.cwd();
}
function getPluginDir(app, manifest) {
  const vaultPath = getVaultPath(app);
  if ((manifest == null ? void 0 : manifest.dir) && typeof manifest.dir === "string") {
    return path.isAbsolute(manifest.dir) ? manifest.dir : path.join(vaultPath, manifest.dir);
  }
  const configDir = app.vault.configDir || ".obsidian";
  return path.join(vaultPath, configDir, "plugins", manifest.id);
}
function getJarPath(pluginDir) {
  const candidates = [
    path.join(pluginDir, "node_modules", "@opendataloader", "pdf", "lib", JAR_NAME),
    path.join(pluginDir, "node_modules", "@opendataloader", "pdf", "dist", "lib", JAR_NAME),
    path.join(__dirname, "node_modules", "@opendataloader", "pdf", "lib", JAR_NAME),
    path.join(__dirname, "node_modules", "@opendataloader", "pdf", "dist", "lib", JAR_NAME),
    path.join(process.cwd(), "node_modules", "@opendataloader", "pdf", "lib", JAR_NAME),
    path.join(process.cwd(), "node_modules", "@opendataloader", "pdf", "dist", "lib", JAR_NAME)
  ];
  const jarPath = candidates.find((candidate) => fs.existsSync(candidate));
  if (!jarPath) {
    throw new JarNotFoundError(candidates);
  }
  return jarPath;
}
function executeJar(pluginDir, args) {
  const jarPath = getJarPath(pluginDir);
  const javaProcess = (0, import_child_process.spawn)("java", ["-jar", jarPath, ...args]);
  let stdout = "";
  let stderr = "";
  javaProcess.stdout.on("data", (data) => {
    stdout += data.toString();
  });
  javaProcess.stderr.on("data", (data) => {
    stderr += data.toString();
  });
  const promise = new Promise((resolve, reject) => {
    javaProcess.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`The opendataloader-pdf CLI exited with code ${code}.

${stderr || stdout}`));
      }
    });
    javaProcess.on("error", (err) => {
      if (err.code === "ENOENT") {
        reject(new JavaNotFoundError());
      } else {
        reject(err);
      }
    });
  });
  return { promise, process: javaProcess };
}
function buildArgs(options) {
  const args = [];
  if (options.outputDir)
    args.push("--output-dir", options.outputDir);
  if (options.password)
    args.push("--password", options.password);
  if (options.format) {
    if (Array.isArray(options.format)) {
      if (options.format.length > 0)
        args.push("--format", options.format.join(","));
    } else {
      args.push("--format", options.format);
    }
  }
  if (options.quiet)
    args.push("--quiet");
  if (options.contentSafetyOff) {
    if (Array.isArray(options.contentSafetyOff)) {
      if (options.contentSafetyOff.length > 0)
        args.push("--content-safety-off", options.contentSafetyOff.join(","));
    } else {
      args.push("--content-safety-off", options.contentSafetyOff);
    }
  }
  if (options.sanitize)
    args.push("--sanitize");
  if (options.keepLineBreaks)
    args.push("--keep-line-breaks");
  if (options.replaceInvalidChars)
    args.push("--replace-invalid-chars", options.replaceInvalidChars);
  if (options.useStructTree)
    args.push("--use-struct-tree");
  if (options.tableMethod)
    args.push("--table-method", options.tableMethod);
  if (options.readingOrder)
    args.push("--reading-order", options.readingOrder);
  if (options.markdownPageSeparator)
    args.push("--markdown-page-separator", options.markdownPageSeparator);
  if (options.textPageSeparator)
    args.push("--text-page-separator", options.textPageSeparator);
  if (options.htmlPageSeparator)
    args.push("--html-page-separator", options.htmlPageSeparator);
  if (options.imageOutput)
    args.push("--image-output", options.imageOutput);
  if (options.imageFormat)
    args.push("--image-format", options.imageFormat);
  if (options.imageDir)
    args.push("--image-dir", options.imageDir);
  if (options.pages)
    args.push("--pages", options.pages);
  if (options.includeHeaderFooter)
    args.push("--include-header-footer");
  if (options.detectStrikethrough)
    args.push("--detect-strikethrough");
  if (options.hybrid && options.hybrid !== "off")
    args.push("--hybrid", options.hybrid);
  if (options.hybridMode)
    args.push("--hybrid-mode", options.hybridMode);
  if (options.hybridUrl)
    args.push("--hybrid-url", options.hybridUrl);
  if (options.hybridTimeout != null && options.hybridTimeout !== "")
    args.push("--hybrid-timeout", String(options.hybridTimeout));
  if (options.hybridFallback)
    args.push("--hybrid-fallback");
  if (options.toStdout)
    args.push("--to-stdout");
  return args;
}
function convert(pluginDir, inputPaths, options = {}) {
  const inputList = Array.isArray(inputPaths) ? inputPaths : [inputPaths];
  if (inputList.length === 0)
    throw new Error("At least one input path must be provided.");
  for (const input of inputList) {
    if (!fs.existsSync(input))
      throw new Error(`Input file or folder not found: ${input}`);
  }
  return executeJar(pluginDir, [...inputList, ...buildArgs(options)]);
}
var PdfToMdSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin");
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "PDF to MD" });
    new import_obsidian.Setting(containerEl).setName("Default conversion mode").setDesc("Mode selected when the conversion dialog opens.").addDropdown((dropdown) => {
      CONVERSION_MODES.forEach((mode) => dropdown.addOption(mode.id, mode.name));
      dropdown.setValue(this.plugin.settings.defaultMode).onChange(async (value) => {
        this.plugin.settings.defaultMode = value;
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian.Setting(containerEl).setName("Hybrid backend URL").setDesc("Used by all hybrid modes. The default OpenDataLoader backend listens on http://localhost:5002.").addText(
      (text) => text.setPlaceholder(DEFAULT_SETTINGS.hybridUrl).setValue(this.plugin.settings.hybridUrl).onChange(async (value) => {
        this.plugin.settings.hybridUrl = value.trim() || DEFAULT_SETTINGS.hybridUrl;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Hybrid timeout").setDesc("Milliseconds before the client gives up. Use 0 for no timeout.").addText(
      (text) => text.setPlaceholder(DEFAULT_SETTINGS.hybridTimeout).setValue(this.plugin.settings.hybridTimeout).onChange(async (value) => {
        this.plugin.settings.hybridTimeout = value.trim() || DEFAULT_SETTINGS.hybridTimeout;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Fallback to local processing").setDesc("When enabled, hybrid modes can fall back to Java-only conversion if the backend fails.").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.hybridFallback).onChange(async (value) => {
        this.plugin.settings.hybridFallback = value;
        await this.plugin.saveSettings();
      })
    );
  }
};
var ConvertModal = class extends import_obsidian.Modal {
  constructor(app, file, pluginDir, settings, saveSettings) {
    super(app);
    __publicField(this, "file");
    __publicField(this, "pluginDir");
    __publicField(this, "settings");
    __publicField(this, "saveSettings");
    __publicField(this, "nameInput");
    __publicField(this, "folderInput");
    __publicField(this, "imageInput");
    __publicField(this, "statusEl");
    __publicField(this, "convertBtn");
    __publicField(this, "modeDescEl");
    __publicField(this, "selectedModeId");
    __publicField(this, "activeProcess", null);
    this.file = file;
    this.pluginDir = pluginDir;
    this.settings = settings;
    this.saveSettings = saveSettings;
    this.selectedModeId = settings.defaultMode;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("pcm-root");
    const header = contentEl.createDiv("pcm-header");
    header.createEl("div", { cls: "pcm-title", text: "PDF \u2192 Markdown" });
    header.createEl("div", { cls: "pcm-file", text: this.file.name });
    const nameRow = contentEl.createDiv("pcm-row");
    this.nameInput = nameRow.createEl("input", {
      cls: "pcm-input",
      attr: { type: "text", spellcheck: "false" }
    });
    this.nameInput.value = this.file.basename;
    nameRow.createEl("span", { cls: "pcm-ext", text: ".md" });
    this.folderInput = this.createFolderRow(
      contentEl,
      "OUT",
      "Vault root if empty",
      this.settings.lastOutputFolder
    );
    this.imageInput = this.createFolderRow(
      contentEl,
      "IMG",
      "Vault root if empty",
      this.settings.lastImageFolder
    );
    const modeBar = contentEl.createDiv("pcm-mode-bar");
    CONVERSION_MODES.forEach((mode) => {
      const btn = modeBar.createEl("button", {
        cls: "pcm-mode-btn" + (mode.id === this.selectedModeId ? " active" : ""),
        text: mode.name
      });
      btn.dataset.modeId = mode.id;
      btn.onclick = () => this.selectMode(mode.id);
    });
    this.modeDescEl = contentEl.createDiv("pcm-mode-desc");
    const footer = contentEl.createDiv("pcm-footer");
    this.statusEl = footer.createDiv("pcm-status pcm-status-idle");
    this.statusEl.textContent = "Ready";
    this.convertBtn = footer.createEl("button", { cls: "pcm-convert-btn", text: "Convert" });
    this.convertBtn.onclick = () => this.runConvert();
    this.nameInput.addEventListener("focus", () => this.nameInput.select());
    this.nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter")
        this.runConvert();
    });
    this.folderInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter")
        this.runConvert();
    });
    this.imageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter")
        this.runConvert();
    });
    this.updateModeDescription();
    setTimeout(() => this.nameInput.focus(), 50);
  }
  createFolderRow(container, tag, placeholder, initialValue) {
    const row = container.createDiv("pcm-row");
    row.createEl("span", { cls: "pcm-row-tag", text: tag });
    const icon = row.createEl("span", { cls: "pcm-folder-icon" });
    icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`;
    const input = row.createEl("input", {
      cls: "pcm-input",
      attr: { type: "text", placeholder, spellcheck: "false" }
    });
    if (initialValue)
      input.value = initialValue;
    const browse = row.createEl("button", { cls: "pcm-browse-btn" });
    browse.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
    browse.onclick = () => {
      new FolderSuggestModal(this.app, (folderPath) => {
        input.value = folderPath;
      }).open();
    };
    return input;
  }
  selectMode(id) {
    this.selectedModeId = id;
    const btns = this.contentEl.querySelectorAll(".pcm-mode-btn");
    btns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.modeId === id);
    });
    this.updateModeDescription();
  }
  updateModeDescription() {
    const mode = CONVERSION_MODES.find((m) => m.id === this.selectedModeId);
    this.modeDescEl.textContent = mode ? mode.description : "";
  }
  async runConvert() {
    var _a, _b, _c, _d, _e, _f, _g;
    const rawName = (_b = (_a = this.nameInput) == null ? void 0 : _a.value) == null ? void 0 : _b.trim();
    if (!rawName) {
      this.setStatus("error", "Please enter a filename");
      if (this.nameInput)
        this.nameInput.focus();
      return;
    }
    if (/[/\\:*?"<>|]/.test(rawName)) {
      this.setStatus("error", 'Name contains invalid characters: / \\ : * ? " < > |');
      if (this.nameInput)
        this.nameInput.focus();
      return;
    }
    const outputFolder = (_d = (_c = this.folderInput) == null ? void 0 : _c.value) == null ? void 0 : _d.trim();
    if (outputFolder) {
      if (outputFolder.split("/").some((s) => s === ".." || /[\\:*?"<>|]/.test(s))) {
        this.setStatus("error", "Output folder path is invalid");
        if (this.folderInput)
          this.folderInput.focus();
        return;
      }
    }
    const imageFolder = (_f = (_e = this.imageInput) == null ? void 0 : _e.value) == null ? void 0 : _f.trim();
    if (imageFolder) {
      if (imageFolder.split("/").some((s) => s === ".." || /[\\:*?"<>|]/.test(s))) {
        this.setStatus("error", "Image folder path is invalid");
        if (this.imageInput)
          this.imageInput.focus();
        return;
      }
    }
    this.setFormDisabled(true);
    this.setStatus("converting", "Checking Java installation...");
    try {
      await checkJavaAvailable();
      new import_obsidian.Notice(`\u{1F4C4} Converting ${this.file.name} to Markdown...`);
      const vaultPath = getVaultPath(this.app);
      if (!vaultPath || typeof vaultPath !== "string") {
        throw new Error(`Invalid vault path: ${vaultPath}`);
      }
      let outputDir = vaultPath;
      if (outputFolder) {
        outputDir = path.join(vaultPath, outputFolder);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
      }
      const pdfAbs = path.join(vaultPath, this.file.path);
      if (!fs.existsSync(pdfAbs)) {
        throw new Error(`PDF file not found: ${pdfAbs}`);
      }
      const selectedMode = getMode(this.selectedModeId);
      if (selectedMode.requiresHybrid) {
        this.setStatus("converting", `Checking hybrid backend at ${this.settings.hybridUrl}...`);
        await assertHybridBackendAvailable(this.settings);
      }
      this.setStatus("converting", `Converting with ${selectedMode.name}...`);
      const conversionOptions = getConversionOptions(selectedMode, this.settings, outputDir);
      if (imageFolder) {
        const baseImageDir = path.isAbsolute(imageFolder) ? imageFolder : path.join(vaultPath, imageFolder);
        const imageDir = path.join(baseImageDir, this.file.basename);
        if (!fs.existsSync(imageDir)) {
          fs.mkdirSync(imageDir, { recursive: true });
        }
        conversionOptions.imageDir = imageDir;
      }
      const { promise: conversionPromise, process: javaProcess } = convert(this.pluginDir, [pdfAbs], conversionOptions);
      this.activeProcess = javaProcess;
      try {
        await conversionPromise;
      } finally {
        this.activeProcess = null;
      }
      const expectedMdPath = path.join(outputDir, this.file.basename + ".md");
      if (!fs.existsSync(expectedMdPath)) {
        throw new Error(
          `Conversion completed but no .md file was created.

Expected file: ${expectedMdPath}
Please check if the PDF file is valid and try again.`
        );
      }
      const targetMd = path.join(outputDir, rawName + ".md");
      if (expectedMdPath !== targetMd) {
        fs.renameSync(expectedMdPath, targetMd);
      }
      this.settings.lastOutputFolder = outputFolder || "";
      this.settings.lastImageFolder = imageFolder || "";
      await this.saveSettings();
      const outputLocation = outputFolder ? `${outputFolder}/${rawName}.md` : `${rawName}.md`;
      this.setStatus("done", `Saved as ${outputLocation}`);
      new import_obsidian.Notice(`\u2705 Successfully converted to ${outputLocation}`);
      setTimeout(() => this.close(), 1800);
    } catch (e) {
      let errorMessage;
      if (e instanceof JavaNotFoundError) {
        errorMessage = e.message;
      } else if (e instanceof JarNotFoundError) {
        errorMessage = "PDF conversion library not found. Please reinstall the plugin.";
      } else if (e instanceof HybridBackendError) {
        const selectedMode = getMode(this.selectedModeId);
        const command = getHybridServerCommand(selectedMode, this.settings) || "opendataloader-pdf-hybrid --port 5002";
        errorMessage = `Hybrid backend is required for this mode.

Start it in a terminal first:
${command}

Then retry the conversion.`;
      } else {
        errorMessage = (_g = e.message) != null ? _g : "Conversion failed";
      }
      this.setStatus("error", errorMessage);
      new import_obsidian.Notice(`\u274C Conversion failed: ${errorMessage}`);
      this.setFormDisabled(false);
      if (this.convertBtn)
        this.convertBtn.textContent = "Retry";
    }
  }
  setFormDisabled(disabled) {
    if (this.nameInput)
      this.nameInput.disabled = disabled;
    if (this.folderInput)
      this.folderInput.disabled = disabled;
    if (this.imageInput)
      this.imageInput.disabled = disabled;
    if (this.convertBtn)
      this.convertBtn.disabled = disabled;
    this.contentEl.querySelectorAll(".pcm-mode-btn, .pcm-browse-btn").forEach((btn) => {
      if (disabled)
        btn.setAttribute("disabled", "");
      else
        btn.removeAttribute("disabled");
    });
  }
  setStatus(type, text) {
    if (this.statusEl) {
      this.statusEl.className = `pcm-status pcm-status-${type}`;
      if (type === "converting") {
        this.statusEl.innerHTML = `<span class="pcm-spinner"></span><span>${text}</span>`;
      } else {
        this.statusEl.textContent = text;
      }
    }
  }
  onClose() {
    var _a;
    (_a = this.activeProcess) == null ? void 0 : _a.kill("SIGTERM");
    this.contentEl.empty();
  }
};
var FolderSuggestModal = class extends import_obsidian.SuggestModal {
  constructor(app, onChoose) {
    super(app);
    __publicField(this, "onChoose");
    __publicField(this, "folders");
    this.onChoose = onChoose;
    this.folders = app.vault.getAllLoadedFiles().filter((f) => f instanceof import_obsidian.TFolder).map((f) => f.path);
    this.setPlaceholder("Search or type a folder path...");
  }
  getSuggestions(query) {
    return query ? this.folders.filter((f) => f.toLowerCase().includes(query.toLowerCase())) : this.folders;
  }
  renderSuggestion(folder, el) {
    el.createEl("div", { text: folder || "/" });
  }
  onChooseSuggestion(folder) {
    this.onChoose(folder);
  }
};
