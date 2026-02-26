# Hyperblog Studio Desktop (Windows / Mode 1)

这是一个**壳应用**：只负责把你的 Studio 网页（`/studio/*`）装进桌面窗口里，方便你不打开浏览器也能写作/发布。

默认打开：
- `https://chzarles.github.io/studio/notes`

你也可以指定任意站点/本地地址：
- `--url https://<user>.github.io/studio/notes`
- 或环境变量 `HYPERBLOG_STUDIO_URL`

---

## 开发（本地）

先启动博客前端：
```bash
cd <repo>
pnpm dev
```

再启动桌面壳（会打开 `http://localhost:5173/studio/notes`）：
```bash
cd desktop/studio-desktop
corepack pnpm install
corepack pnpm dev
```

---

## 构建 Windows `.exe`

在 Windows（PowerShell）里：
```powershell
cd desktop/studio-desktop
corepack pnpm install --frozen-lockfile
corepack pnpm build:win
```

产物位置：
- `desktop/studio-desktop/dist/*.exe`

---

## 运行时指定 URL（可选）

你可以用命令行启动并指定 URL：
```powershell
Hyperblog-Studio-0.1.0-windows-x64.exe --url https://<user>.github.io/studio/notes
```

或设置环境变量（对你自己的快捷方式也更方便）：
```powershell
$env:HYPERBLOG_STUDIO_URL="https://<user>.github.io/studio/notes"
Hyperblog-Studio-0.1.0-windows-x64.exe
```

