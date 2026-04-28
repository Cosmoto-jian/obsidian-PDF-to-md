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
var http = __toESM(require("http"));
var https = __toESM(require("https"));
var HybridBackendError = class extends Error {
  constructor(url, detail) {
    super(`Hybrid backend is not reachable at ${url}${detail ? `: ${detail}` : ""}`);
    this.name = "HybridBackendError";
  }
};
var CliNotFoundError = class extends Error {
  constructor() {
    super(`OpenDataLoader CLI not found: ${OPENDATALOADER_CLI}`);
    this.name = "CliNotFoundError";
  }
};
var PdfToMdPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "pluginDir", "");
    __publicField(this, "hybridBackendProcess", null);
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
          (item) => item.setTitle("Convert to Markdown").setIcon("file-text").onClick(() => this.openConvertModal(file))
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
            this.openConvertModal(file);
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
          (item) => item.setTitle("Convert to Markdown").setIcon("file-text").onClick(() => this.openConvertModal(pdfFile))
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
  openConvertModal(file) {
    new ConvertModal(this.app, this, file).open();
  }
  async ensureHybridBackend() {
    var _a, _b;
    if (await isHybridBackendAvailable(this.settings))
      return;
    if (this.hybridBackendProcess && !this.hybridBackendProcess.killed) {
      await waitForHybridBackend(this.settings, HYBRID_STARTUP_TIMEOUT_MS, this.hybridBackendProcess);
      return;
    }
    if (!fs.existsSync(HYBRID_BACKEND_BIN) || !fs.existsSync(HYBRID_PYTHON_BIN)) {
      throw new HybridBackendError(
        this.settings.hybridUrl,
        `Missing conda executable. Checked: ${HYBRID_BACKEND_BIN}, ${HYBRID_PYTHON_BIN}`
      );
    }
    const logPath = path.join(this.pluginDir, HYBRID_LOG_NAME);
    fs.writeFileSync(logPath, `Starting hybrid backend at ${(/* @__PURE__ */ new Date()).toISOString()}
`);
    const proc = (0, import_child_process.spawn)(HYBRID_PYTHON_BIN, [HYBRID_BACKEND_BIN, ...getHybridServerArgs(this.settings)], {
      cwd: this.pluginDir,
      stdio: "pipe",
      detached: false,
      env: getHybridEnv()
    });
    this.hybridBackendProcess = proc;
    (_a = proc.stdout) == null ? void 0 : _a.on("data", (data) => fs.appendFileSync(logPath, data.toString()));
    (_b = proc.stderr) == null ? void 0 : _b.on("data", (data) => fs.appendFileSync(logPath, data.toString()));
    proc.once("close", () => {
      if (this.hybridBackendProcess === proc)
        this.hybridBackendProcess = null;
    });
    await waitForHybridBackend(this.settings, HYBRID_STARTUP_TIMEOUT_MS, proc, logPath);
  }
  onunload() {
    if (this.hybridBackendProcess) {
      this.hybridBackendProcess.kill();
      this.hybridBackendProcess = null;
    }
  }
};
var DEFAULT_SETTINGS = {
  defaultMode: "fast",
  hybridUrl: "http://127.0.0.1:5012",
  hybridTimeout: "0",
  lastOutputFolder: "",
  lastImageFolder: "",
  exportImages: true
};
var OPENDATALOADER_CLI = "/opt/anaconda3/bin/opendataloader-pdf";
var HYBRID_BACKEND_BIN = "/opt/anaconda3/bin/opendataloader-pdf-hybrid";
var HYBRID_PYTHON_BIN = "/opt/anaconda3/bin/python3.12";
var HYBRID_STARTUP_TIMEOUT_MS = 18e4;
var HEALTH_CHECK_TIMEOUT_MS = 2500;
var HYBRID_LOG_NAME = "hybrid-backend.log";
var CONVERSION_MODES = [
  {
    id: "fast",
    name: "Fast",
    description: "Java-only conversion for standard digital PDFs. No backend required."
  },
  {
    id: "hybrid",
    name: "Hybrid",
    description: "Uses the hybrid backend for OCR and complex layouts.",
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
  settings.hybridUrl = normalizeHybridUrl(settings.hybridUrl);
  if (!settings.hybridTimeout)
    settings.hybridTimeout = DEFAULT_SETTINGS.hybridTimeout;
  return settings;
}
function normalizeHybridUrl(value) {
  try {
    const url = new URL(value || DEFAULT_SETTINGS.hybridUrl);
    if (url.hostname === "localhost")
      url.hostname = "127.0.0.1";
    if (url.hostname === "127.0.0.1" && url.port === "5002")
      url.port = "5012";
    return url.toString().replace(/\/$/, "");
  } catch (e) {
    return DEFAULT_SETTINGS.hybridUrl;
  }
}
function getHybridPort(settings) {
  try {
    return new URL(settings.hybridUrl).port || "5012";
  } catch (e) {
    return "5012";
  }
}
function getHybridHost(settings) {
  try {
    const host = new URL(settings.hybridUrl).hostname;
    return host === "localhost" ? "127.0.0.1" : host;
  } catch (e) {
    return "127.0.0.1";
  }
}
function getHybridServerCommand(mode, settings) {
  if (!mode.requiresHybrid)
    return null;
  return `${HYBRID_BACKEND_BIN} ${getHybridServerArgs(settings).join(" ")}`;
}
function getHybridServerArgs(settings) {
  return [
    "--host",
    getHybridHost(settings),
    "--port",
    getHybridPort(settings),
    "--device",
    "auto"
  ];
}
function getHybridEnv() {
  return {
    ...process.env,
    CONDA_PREFIX: "/opt/anaconda3",
    CONDA_DEFAULT_ENV: "base",
    CONDA_SHLVL: process.env.CONDA_SHLVL || "1",
    PYTHONNOUSERSITE: "1",
    HOME: process.env.HOME || "/Users/waltry",
    LANG: process.env.LANG || "en_US.UTF-8",
    LC_ALL: process.env.LC_ALL || process.env.LANG || "en_US.UTF-8",
    PATH: [
      "/opt/anaconda3/bin",
      "/opt/anaconda3/condabin",
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/bin",
      "/usr/sbin",
      "/sbin",
      process.env.PATH || ""
    ].filter(Boolean).join(":")
  };
}
async function isHybridBackendAvailable(settings) {
  return requestOk(`${settings.hybridUrl.replace(/\/+$/, "")}/health`, HEALTH_CHECK_TIMEOUT_MS);
}
async function waitForHybridBackend(settings, timeoutMs, proc, logPath) {
  var _a, _b;
  const startedAt = Date.now();
  let output = "";
  let processError = null;
  (_a = proc == null ? void 0 : proc.stdout) == null ? void 0 : _a.on("data", (data) => {
    output = (output + data.toString()).slice(-4e3);
  });
  (_b = proc == null ? void 0 : proc.stderr) == null ? void 0 : _b.on("data", (data) => {
    output = (output + data.toString()).slice(-4e3);
  });
  proc == null ? void 0 : proc.once("error", (err) => {
    processError = err;
  });
  while (Date.now() - startedAt < timeoutMs) {
    if (processError) {
      throw new HybridBackendError(settings.hybridUrl, `Process error: ${processError.message}${logPath ? `
Log: ${logPath}` : ""}`);
    }
    if ((proc == null ? void 0 : proc.exitCode) !== null) {
      throw new HybridBackendError(
        settings.hybridUrl,
        `Process exited with code ${proc.exitCode}${output ? `
${output}` : ""}${logPath ? `
Log: ${logPath}` : ""}`
      );
    }
    if (await isHybridBackendAvailable(settings))
      return;
    await delay(1e3);
  }
  proc == null ? void 0 : proc.kill();
  throw new HybridBackendError(
    settings.hybridUrl,
    `Startup timed out after ${Math.round(timeoutMs / 1e3)}s${output ? `
${output}` : ""}${logPath ? `
Log: ${logPath}` : ""}`
  );
}
function requestOk(rawUrl, timeoutMs) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(rawUrl);
    } catch (e) {
      resolve(false);
      return;
    }
    const client = url.protocol === "https:" ? https : http;
    const req = client.get(url, (res) => {
      var _a, _b;
      res.resume();
      resolve(((_a = res.statusCode) != null ? _a : 0) >= 200 && ((_b = res.statusCode) != null ? _b : 0) < 400);
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
  });
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
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
function convertPdf(request) {
  if (!fs.existsSync(OPENDATALOADER_CLI))
    throw new CliNotFoundError();
  if (!fs.existsSync(request.inputPath))
    throw new Error(`PDF file not found: ${request.inputPath}`);
  const args = buildCliArgs(request);
  const cliProcess = (0, import_child_process.spawn)(OPENDATALOADER_CLI, args, {
    env: getHybridEnv()
  });
  let stdout = "";
  let stderr = "";
  cliProcess.stdout.on("data", (data) => {
    stdout += data.toString();
  });
  cliProcess.stderr.on("data", (data) => {
    stderr += data.toString();
  });
  const promise = new Promise((resolve, reject) => {
    cliProcess.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`opendataloader-pdf exited with code ${code}.

${stderr || stdout}`));
      }
    });
    cliProcess.on("error", reject);
  });
  return { promise, process: cliProcess };
}
function buildCliArgs(request) {
  const args = [
    request.inputPath,
    "--output-dir",
    request.outputDir,
    "--format",
    "markdown",
    "--keep-line-breaks",
    "--table-method",
    "cluster",
    "--image-output",
    request.exportImages ? "external" : "off"
  ];
  if (request.exportImages && request.imageDir)
    args.push("--image-dir", request.imageDir);
  if (request.mode.requiresHybrid) {
    args.push(
      "--hybrid",
      "docling-fast",
      "--hybrid-mode",
      "auto",
      "--hybrid-url",
      request.settings.hybridUrl,
      "--hybrid-timeout",
      request.settings.hybridTimeout
    );
  }
  return args;
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
    new import_obsidian.Setting(containerEl).setName("Hybrid backend URL").setDesc("Used by Hybrid mode. The plugin starts the conda backend on http://127.0.0.1:5012 by default.").addText(
      (text) => text.setPlaceholder(DEFAULT_SETTINGS.hybridUrl).setValue(this.plugin.settings.hybridUrl).onChange(async (value) => {
        this.plugin.settings.hybridUrl = normalizeHybridUrl(value.trim());
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Hybrid timeout").setDesc("Milliseconds before the client gives up. Use 0 for no timeout.").addText(
      (text) => text.setPlaceholder(DEFAULT_SETTINGS.hybridTimeout).setValue(this.plugin.settings.hybridTimeout).onChange(async (value) => {
        this.plugin.settings.hybridTimeout = value.trim() || DEFAULT_SETTINGS.hybridTimeout;
        await this.plugin.saveSettings();
      })
    );
  }
};
var ConvertModal = class extends import_obsidian.Modal {
  constructor(app, plugin, file) {
    super(app);
    __publicField(this, "plugin");
    __publicField(this, "file");
    __publicField(this, "nameInput");
    __publicField(this, "folderInput");
    __publicField(this, "imageInput");
    __publicField(this, "exportImagesInput");
    __publicField(this, "statusEl");
    __publicField(this, "convertBtn");
    __publicField(this, "modeDescEl");
    __publicField(this, "selectedModeId");
    __publicField(this, "formDisabled", false);
    this.plugin = plugin;
    this.file = file;
    this.selectedModeId = plugin.settings.defaultMode;
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
      this.plugin.settings.lastOutputFolder
    );
    this.imageInput = this.createFolderRow(
      contentEl,
      "IMG",
      "Vault root if empty",
      this.plugin.settings.lastImageFolder
    );
    const imageToggleRow = contentEl.createDiv("pcm-toggle-row");
    imageToggleRow.createEl("span", { cls: "pcm-row-tag", text: "PIC" });
    const toggleLabel = imageToggleRow.createEl("label", { cls: "pcm-toggle-label" });
    this.exportImagesInput = toggleLabel.createEl("input", {
      attr: { type: "checkbox" }
    });
    this.exportImagesInput.checked = this.plugin.settings.exportImages;
    toggleLabel.createEl("span", { cls: "pcm-toggle-box" });
    toggleLabel.createEl("span", { cls: "pcm-toggle-text", text: "Export images" });
    this.exportImagesInput.onchange = () => this.updateImageControls();
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
    this.updateImageControls();
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
    this.updateImageControls();
  }
  async runConvert() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
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
    const selectedMode = getMode(this.selectedModeId);
    const exportImagesPreference = !!((_g = this.exportImagesInput) == null ? void 0 : _g.checked);
    const exportImages = !!selectedMode.requiresHybrid && exportImagesPreference;
    if (exportImages && imageFolder) {
      if (imageFolder.split("/").some((s) => s === ".." || /[\\:*?"<>|]/.test(s))) {
        this.setStatus("error", "Image folder path is invalid");
        if (this.imageInput)
          this.imageInput.focus();
        return;
      }
    }
    this.setFormDisabled(true);
    this.setStatus("converting", "Preparing conversion...");
    try {
      await this.rememberSettings(outputFolder, imageFolder, exportImagesPreference);
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
      if (selectedMode.requiresHybrid) {
        this.setStatus("converting", "Starting hybrid backend with OCR support...");
        await this.plugin.ensureHybridBackend();
      }
      this.setStatus("converting", `Converting with ${selectedMode.name}...`);
      let imageDir;
      if (exportImages && imageFolder) {
        const baseImageDir = path.isAbsolute(imageFolder) ? imageFolder : path.join(vaultPath, imageFolder);
        imageDir = path.join(baseImageDir, this.file.basename);
        if (!fs.existsSync(imageDir)) {
          fs.mkdirSync(imageDir, { recursive: true });
        }
      }
      const { promise: conversionPromise } = convertPdf({
        inputPath: pdfAbs,
        outputDir,
        imageDir,
        exportImages,
        mode: selectedMode,
        settings: this.plugin.settings
      });
      await conversionPromise;
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
      const outputLocation = outputFolder ? `${outputFolder}/${rawName}.md` : `${rawName}.md`;
      this.setStatus("done", `Saved as ${outputLocation}`);
      new import_obsidian.Notice(`\u2705 Successfully converted to ${outputLocation}`);
      setTimeout(() => this.close(), 1800);
    } catch (e) {
      let errorMessage;
      if (e instanceof CliNotFoundError) {
        errorMessage = e.message;
      } else if (e instanceof HybridBackendError) {
        const selectedMode2 = getMode(this.selectedModeId);
        const command = getHybridServerCommand(selectedMode2, this.plugin.settings) || `${HYBRID_BACKEND_BIN} --port 5012`;
        errorMessage = `Hybrid backend is required for this mode.

Auto-start command:
${command}

${e.message}`;
      } else {
        errorMessage = (_h = e.message) != null ? _h : "Conversion failed";
      }
      this.setStatus("error", errorMessage);
      new import_obsidian.Notice(`\u274C Conversion failed: ${errorMessage}`);
      this.setFormDisabled(false);
      if (this.convertBtn)
        this.convertBtn.textContent = "Retry";
    }
  }
  setFormDisabled(disabled) {
    this.formDisabled = disabled;
    if (this.nameInput)
      this.nameInput.disabled = disabled;
    if (this.folderInput)
      this.folderInput.disabled = disabled;
    this.updateImageControls();
    if (this.convertBtn)
      this.convertBtn.disabled = disabled;
    this.contentEl.querySelectorAll(".pcm-mode-btn, .pcm-browse-btn, .pcm-toggle-label input").forEach((btn) => {
      if (disabled)
        btn.setAttribute("disabled", "");
      else
        btn.removeAttribute("disabled");
    });
  }
  async rememberSettings(outputFolder, imageFolder, exportImages) {
    this.plugin.settings.lastOutputFolder = outputFolder || "";
    this.plugin.settings.lastImageFolder = imageFolder || "";
    this.plugin.settings.exportImages = exportImages;
    await this.plugin.saveSettings();
  }
  updateImageControls() {
    var _a, _b, _c;
    const selectedMode = getMode(this.selectedModeId);
    const modeAllowsImages = !!selectedMode.requiresHybrid;
    const enabled = modeAllowsImages && !!((_a = this.exportImagesInput) == null ? void 0 : _a.checked);
    if (this.exportImagesInput) {
      this.exportImagesInput.disabled = this.formDisabled || !modeAllowsImages;
    }
    if (this.imageInput) {
      this.imageInput.disabled = this.formDisabled || !enabled;
      (_b = this.imageInput.parentElement) == null ? void 0 : _b.toggleClass("is-disabled", !modeAllowsImages || !enabled);
    }
    (_c = this.contentEl.querySelector(".pcm-toggle-row")) == null ? void 0 : _c.toggleClass("is-disabled", !modeAllowsImages);
    const toggleText = this.contentEl.querySelector(".pcm-toggle-text");
    if (toggleText) {
      toggleText.textContent = modeAllowsImages ? "Export images" : "Hybrid images only";
    }
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
