const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

if (process.platform === "linux") {
  app.commandLine.appendSwitch("no-sandbox");
}

const CONFIG_NAME = "aliquot-desktop.json";

function configPath() {
  return path.join(app.getPath("userData"), CONFIG_NAME);
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), "utf8"));
  } catch {
    return null;
  }
}

function writeConfig(config) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(config, null, 2));
}

function projectRoot() {
  return path.join(__dirname, "..");
}

function standaloneServerPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "standalone", "server.js");
  }
  return path.join(projectRoot(), ".next", "standalone", "server.js");
}

function waitForUrl(url, timeoutMs = 90000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - started > timeoutMs) {
          reject(new Error(`Aliquot did not start at ${url}`));
          return;
        }
        setTimeout(tick, 400);
      });
    };
    tick();
  });
}

function startLocalPostgres() {
  try {
    spawn("npm", ["run", "db:up"], {
      cwd: projectRoot(),
      stdio: "ignore",
      detached: true,
      shell: true,
    }).unref();
  } catch {
    /* Postgres may already be running. */
  }
}

function startNextServer(port, host) {
  const standalone = standaloneServerPath();
  const env = { ...process.env, PORT: String(port), HOSTNAME: host };
  if (fs.existsSync(standalone)) {
    const cwd = path.dirname(standalone);
    return spawn(process.execPath, [standalone], { cwd, env, stdio: "inherit" });
  }
  return spawn("npx", ["next", "start", "-H", host, "-p", String(port)], {
    cwd: projectRoot(),
    env,
    stdio: "inherit",
    shell: true,
  });
}

ipcMain.handle("aliquot-save-config", (_event, config) => {
  writeConfig(config);
  app.relaunch();
  app.exit(0);
});

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    backgroundColor: "#F4F6F7",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
    },
  });

  const config = readConfig();
  if (!config) {
    await win.loadFile(path.join(__dirname, "setup.html"));
    return;
  }

  if (config.mode === "client") {
    await win.loadURL(config.labServerUrl || "http://127.0.0.1:3000");
    return;
  }

  const port = Number(process.env.ALIQUOT_PORT || config.port || 3000);
  const host = process.env.ALIQUOT_HOST || config.host || "0.0.0.0";
  const localUrl = `http://127.0.0.1:${port}`;

  if (!app.isPackaged) {
    try {
      await waitForUrl(localUrl, 4000);
      await win.loadURL(localUrl);
      return;
    } catch {
      dialog.showErrorBox(
        "Aliquot",
        "Start the lab server first (`npm run db:up` then `npm run dev`), then open Electron again. Workstations should use client mode and point at the lab-server URL."
      );
      await win.loadFile(path.join(__dirname, "setup.html"));
      return;
    }
  }

  startLocalPostgres();
  startNextServer(port, host);
  try {
    await waitForUrl(localUrl);
    await win.loadURL(localUrl);
  } catch (error) {
    dialog.showErrorBox("Aliquot", error instanceof Error ? error.message : "Could not start the lab server.");
  }
}

app.whenReady().then(() => {
  void createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
