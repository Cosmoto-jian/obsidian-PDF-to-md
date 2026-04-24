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
var PdfToMdPlugin = class extends import_obsidian.Plugin {
  async onload() {
    this.registerEvent(
      this.app.workspace.on("file-menu", (menu, file) => {
        if (!(file instanceof import_obsidian.TFile) || file.extension.toLowerCase() !== "pdf")
          return;
        menu.addItem(
          (item) => item.setTitle("Convert to Markdown").setIcon("file-text").onClick(() => new ConvertModal(this.app, file).open())
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
            new ConvertModal(this.app, file).open();
          return true;
        }
        return false;
      }
    });
    this.registerEvent(
      this.app.workspace.on("files-menu", (menu, files) => {
        const pdfFiles = files.filter((f) => f instanceof import_obsidian.TFile && f.extension.toLowerCase() === "pdf");
        if (pdfFiles.length === 1) {
          const pdfFile = pdfFiles[0];
          menu.addItem(
            (item) => item.setTitle("Convert to Markdown").setIcon("file-text").onClick(() => new ConvertModal(this.app, pdfFile).open())
          );
        }
      })
    );
  }
};
var CONVERSION_MODES = [
  {
    id: "fast",
    name: "Fast Mode",
    description: "Quick conversion with basic formatting. Works without additional services.",
    options: { format: "markdown" },
    requiresHybrid: false
  },
  {
    id: "standard",
    name: "Standard Mode",
    description: "Balanced conversion with better layout detection and table support.",
    options: {
      format: "markdown",
      useStructTree: true,
      tableMethod: "default"
    },
    requiresHybrid: false
  },
  {
    id: "enhanced",
    name: "Enhanced Mode",
    description: "Improved conversion with image handling and better text extraction.",
    options: {
      format: "markdown",
      useStructTree: true,
      imageOutput: "external",
      imageFormat: "png",
      keepLineBreaks: true
    },
    requiresHybrid: false
  },
  {
    id: "ocr",
    name: "OCR Mode",
    description: "For scanned documents. Enhanced text recognition and sanitization.",
    options: {
      format: "markdown",
      sanitize: true,
      useStructTree: true,
      contentSafetyOff: "all"
    },
    requiresHybrid: false
  },
  {
    id: "formula",
    name: "Formula Mode",
    description: "Enhanced math formula and equation detection.",
    options: {
      format: "markdown",
      useStructTree: true,
      keepLineBreaks: true,
      tableMethod: "cluster"
    },
    requiresHybrid: false
  },
  {
    id: "complete",
    name: "Complete Mode",
    description: "Maximum quality with all enhancements. Best for complex documents.",
    options: {
      format: "markdown",
      useStructTree: true,
      imageOutput: "external",
      imageFormat: "png",
      keepLineBreaks: true,
      sanitize: true,
      detectStrikethrough: true,
      tableMethod: "cluster",
      readingOrder: "xycut"
    },
    requiresHybrid: false
  }
];
var JAR_NAME = "opendataloader-pdf-cli.jar";
function getJarPath() {
  const pluginDir = "/Users/waltry/Library/Mobile Documents/iCloud~md~obsidian/Documents/.obsidian/plugins/obsidian-PDF-to-md";
  const jarPath = path.join(pluginDir, "node_modules", "@opendataloader", "pdf", "lib", JAR_NAME);
  if (!fs.existsSync(jarPath)) {
    throw new Error(`JAR file not found at ${jarPath}. Please reinstall the plugin.`);
  }
  return jarPath;
}
function executeJar(args, executionOptions = {}) {
  const { streamOutput = false } = executionOptions;
  return new Promise((resolve, reject) => {
    const jarPath = getJarPath();
    const command = "java";
    const commandArgs = ["-jar", jarPath, ...args];
    const javaProcess = (0, import_child_process.spawn)(command, commandArgs);
    let stdout = "";
    let stderr = "";
    javaProcess.stdout.on("data", (data) => {
      const chunk = data.toString();
      if (streamOutput)
        process.stdout.write(chunk);
      stdout += chunk;
    });
    javaProcess.stderr.on("data", (data) => {
      const chunk = data.toString();
      if (streamOutput)
        process.stderr.write(chunk);
      stderr += chunk;
    });
    javaProcess.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        const errorOutput = stderr || stdout;
        const error = new Error(`The opendataloader-pdf CLI exited with code ${code}.

${errorOutput}`);
        reject(error);
      }
    });
    javaProcess.on("error", (err) => {
      if (err.message.includes("ENOENT")) {
        reject(new Error("'java' command not found. Please ensure Java is installed and in your system's PATH."));
      } else {
        reject(err);
      }
    });
  });
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
  if (options.toStdout)
    args.push("--to-stdout");
  return args;
}
async function convert(inputPaths, options = {}) {
  const inputList = Array.isArray(inputPaths) ? inputPaths : [inputPaths];
  if (inputList.length === 0) {
    return Promise.reject(new Error("At least one input path must be provided."));
  }
  for (const input of inputList) {
    if (!fs.existsSync(input)) {
      return Promise.reject(new Error(`Input file or folder not found: ${input}`));
    }
  }
  const args = [...inputList, ...buildArgs(options)];
  return executeJar(args, { streamOutput: !options.quiet });
}
var ConvertModal = class extends import_obsidian.Modal {
  constructor(app, file) {
    super(app);
    __publicField(this, "file");
    __publicField(this, "nameInput");
    __publicField(this, "statusEl");
    __publicField(this, "convertBtn");
    __publicField(this, "modeSelect");
    __publicField(this, "folderInput");
    this.file = file;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("pcm-root");
    const hero = contentEl.createDiv("pcm-hero");
    const iconEl = hero.createDiv("pcm-icon");
    iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
        width="22" height="22">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>`;
    const meta = hero.createDiv("pcm-meta");
    meta.createEl("div", { cls: "pcm-source-label", text: "Source" });
    meta.createEl("div", { cls: "pcm-source-name", text: this.file.name });
    const fieldWrap = contentEl.createDiv("pcm-field");
    fieldWrap.createEl("label", { cls: "pcm-label", text: "Save as", attr: { for: "pcm-name" } });
    const inputRow = fieldWrap.createDiv("pcm-input-row");
    this.nameInput = inputRow.createEl("input", {
      cls: "pcm-input",
      attr: { id: "pcm-name", type: "text", spellcheck: "false" }
    });
    this.nameInput.value = this.file.basename;
    inputRow.createEl("span", { cls: "pcm-ext", text: ".md" });
    this.nameInput.addEventListener("focus", () => this.nameInput.select());
    const folderField = contentEl.createDiv("pcm-field");
    folderField.createEl("label", { cls: "pcm-label", text: "Output folder (optional)", attr: { for: "pcm-folder" } });
    const folderInputRow = folderField.createDiv("pcm-input-row");
    this.folderInput = folderInputRow.createEl("input", {
      cls: "pcm-input",
      attr: { id: "pcm-folder", type: "text", placeholder: "e.g., converted-pdfs" }
    });
    const modeField = contentEl.createDiv("pcm-field");
    modeField.createEl("label", { cls: "pcm-label", text: "Conversion Mode", attr: { for: "pcm-mode" } });
    this.modeSelect = modeField.createEl("select", { cls: "pcm-select", attr: { id: "pcm-mode" } });
    CONVERSION_MODES.forEach((mode) => {
      const option = this.modeSelect.createEl("option", {
        value: mode.id,
        text: mode.name
      });
      if (mode.id === "standard") {
        option.selected = true;
      }
    });
    const modeDesc = modeField.createEl("div", { cls: "pcm-mode-desc" });
    this.updateModeDescription();
    this.modeSelect.addEventListener("change", () => {
      this.updateModeDescription();
    });
    this.statusEl = contentEl.createDiv("pcm-status pcm-status-idle");
    this.statusEl.textContent = "Ready";
    const actions = contentEl.createDiv("pcm-actions");
    this.convertBtn = actions.createEl("button", { cls: "pcm-btn pcm-btn-primary", text: "Convert" });
    this.convertBtn.onclick = () => this.runConvert();
    this.nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter")
        this.runConvert();
    });
    this.folderInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter")
        this.runConvert();
    });
    const cancelBtn = actions.createEl("button", { cls: "pcm-btn pcm-btn-secondary", text: "Cancel" });
    cancelBtn.onclick = () => this.close();
    setTimeout(() => this.nameInput.focus(), 50);
  }
  updateModeDescription() {
    const selectedMode = CONVERSION_MODES.find((mode) => mode.id === this.modeSelect.value);
    if (selectedMode) {
      const existingDesc = this.modeSelect.nextElementSibling;
      if (existingDesc && existingDesc.classList.contains("pcm-mode-desc")) {
        existingDesc.remove();
      }
      const descEl = this.modeSelect.parentElement.createEl("div", {
        cls: "pcm-mode-desc",
        text: selectedMode.description
      });
    }
  }
  async runConvert() {
    var _a, _b, _c, _d, _e;
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
    if (outputFolder && /[/\\:*?"<>|]/.test(outputFolder)) {
      this.setStatus("error", 'Folder name contains invalid characters: / \\ : * ? " < > |');
      if (this.folderInput)
        this.folderInput.focus();
      return;
    }
    if (this.convertBtn)
      this.convertBtn.disabled = true;
    if (this.nameInput)
      this.nameInput.disabled = true;
    if (this.folderInput)
      this.folderInput.disabled = true;
    if (this.modeSelect)
      this.modeSelect.disabled = true;
    this.setStatus("converting", "Checking system requirements...");
    try {
      this.setStatus("converting", "Checking Java installation...");
      try {
        (0, import_child_process.execSync)("java -version", { stdio: "pipe" });
      } catch (e) {
        throw new Error(
          "Java Runtime Environment (JRE) is required but not found.\n\nPlease install Java from:\n\u2022 macOS: brew install openjdk\n\u2022 Or download from: https://www.java.com/download/"
        );
      }
      if (!this.file || !this.file.path) {
        throw new Error("Invalid PDF file: file or file path is undefined");
      }
      new import_obsidian.Notice(`\u{1F4C4} Converting ${this.file.name} to Markdown...`);
      let vaultPath;
      try {
        const adapter = this.app.vault.adapter;
        if (adapter.basePath && typeof adapter.basePath === "string") {
          vaultPath = adapter.basePath;
        } else if (adapter.getBasePath && typeof adapter.getBasePath === "function") {
          vaultPath = adapter.getBasePath();
        } else {
          vaultPath = process.cwd();
        }
      } catch (e) {
        vaultPath = process.cwd();
      }
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
      if (!this.file.path || typeof this.file.path !== "string") {
        throw new Error(`Invalid file path: ${this.file.path}`);
      }
      const pdfAbs = path.join(vaultPath, this.file.path);
      if (!fs.existsSync(pdfAbs)) {
        throw new Error(`PDF file not found: ${pdfAbs}`);
      }
      const selectedMode = CONVERSION_MODES.find((mode) => mode.id === this.modeSelect.value) || CONVERSION_MODES[1];
      this.setStatus("converting", `Converting with ${selectedMode.name}...`);
      const conversionOptions = {
        ...selectedMode.options,
        outputDir,
        quiet: false
      };
      const result = await convert([pdfAbs], conversionOptions);
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
      try {
        await this.app.vault.adapter.list("/");
      } catch (e) {
      }
      const outputLocation = outputFolder ? `${outputFolder}/${rawName}.md` : `${rawName}.md`;
      this.setStatus("done", `Saved as ${outputLocation}`);
      new import_obsidian.Notice(`\u2705 Successfully converted to ${outputLocation}`);
      setTimeout(() => this.close(), 1800);
    } catch (e) {
      let errorMessage = (_e = e.message) != null ? _e : "Conversion failed";
      if (errorMessage.includes("java")) {
        errorMessage = "Java is required but not installed. Please install Java Runtime Environment.";
      } else if (errorMessage.includes("JAR file not found") || errorMessage.includes("Could not locate")) {
        errorMessage = "PDF conversion library not found. Please reinstall the plugin.";
      } else if (errorMessage.includes("path.join") || errorMessage.includes("path.resolve")) {
        errorMessage = "Path error: Invalid file or directory path. Please check your vault configuration.";
      }
      this.setStatus("error", errorMessage);
      new import_obsidian.Notice(`\u274C Conversion failed: ${errorMessage}`);
      if (this.convertBtn)
        this.convertBtn.disabled = false;
      if (this.nameInput)
        this.nameInput.disabled = false;
      if (this.folderInput)
        this.folderInput.disabled = false;
      if (this.modeSelect)
        this.modeSelect.disabled = false;
      if (this.convertBtn)
        this.convertBtn.textContent = "Retry";
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
    if (this.contentEl) {
      this.contentEl.empty();
    }
  }
};
