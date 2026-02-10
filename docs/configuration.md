# 配置文档 v0

本项目是 **文件驱动**：`content/*` 是内容与配置的源（Source of Truth），开发时由 mock API 读取，构建时会被打包成 `dist/api/*.json` 给公开站点静态访问。

## `content/profile.json`

用途：

- 公开站点（`/`、导航栏）：展示作者信息、社交链接、首页 Hero 形态
- Studio（发布台）：读取 `publisherBaseUrl` 作为默认 Publisher API 地址（也可被环境变量覆盖）

### 顶层字段

- `name`：站点/作者名（首页 Hero + 左上角品牌区）
- `handle`：@id（首页 Hero）
- `tagline`：一句话描述（首页 Hero + 左上角品牌区）
- `nav`：可选，覆盖左上角品牌区的显示文案（不影响首页 Hero）
  - `nav.title`：左上角第一行（默认 `name`）
  - `nav.tagline`：左上角第二行（默认 `tagline`）
- `accent`：强调色（HSL 三段字符串，如 `"270 85% 45%"`），用于 UI 的 `--accent`
- `publisherBaseUrl`：Publisher API Base URL（例如 `https://<worker>.workers.dev`）
- `links[]`：社交/外链按钮（显示在顶部导航右侧；会自动图标化 GitHub/X）
  - `label`：显示名（同时用于选择图标）
  - `href`：跳转链接

### `hero`（首页封面）

`hero` 只影响首页 `/` 的大封面区域（Hero）。

字段总览见类型：`src/ui/types.ts:9`

基础文案（可选覆盖）：

- `hero.title`：首页 Hero 标题（默认 `name`）
- `hero.tagline`：首页 Hero 副标题（默认 `tagline`，若也为空则用内置 fallback）

常见需求：**左上角短一些，首页 Hero 长一些**：

```json
{
  "name": "Charles",
  "tagline": "AI Infra / Observability",
  "nav": { "title": "Charles", "tagline": "AI Infra" },
  "hero": { "variant": "mimo", "title": "这里有一些碎片，或许你能拼出什么", "tagline": "AI Infra / Observability / 写作系统化" }
}
```

#### `hero.variant`

- `"mimo"`：MiMo 风格（纸感底 + 字纹背景 + 跟随鼠标的光圈反相）
- `"image"`：图片封面（可调 blur/opacity/tint/wash 等）

判定规则（代码：`src/ui/views/HomePage.tsx:51`）：

1. `variant === "mimo"` → 强制 MiMo
2. 否则若 `imageUrl` 存在 → 图片封面
3. 否则 → 默认 MiMo

#### MiMo 风格（`variant: "mimo"`）

最小示例：

```json
{
  "hero": {
    "variant": "mimo",
    "patternText": "AI INFRA",
    "spotlightRadiusPx": 260,
    "textScale": 1.15
  }
}
```

- `patternText`：字纹里重复的 token（默认会用 `hero.patternText || handle || name || "HYPERBLOG"`）
- `spotlightRadiusPx`：光圈半径（px），仅 MiMo 生效；默认 `240`，并会 clamp 到 `120..520`
- `textScale`：标题/handle/tagline 的字号整体缩放倍率；MiMo 下 clamp 到 `0.85..1.6`

#### 图片封面（`variant: "image"`）

最小示例（推荐把图片放在 `public/` 下）：

```json
{
  "hero": {
    "variant": "image",
    "imageUrl": "/mountain.avif"
  }
}
```

常用进阶示例（更清晰、更少“白雾”）：

```json
{
  "hero": {
    "variant": "image",
    "imageUrl": "/mountain.avif",
    "preload": true,
    "blurPx": 0,
    "opacity": 0.35,
    "position": "center",
    "tintOpacity": 0.9,
    "washOpacity": 0.0,
    "saturate": 1.1,
    "contrast": 1.05,
    "textColor": { "light": "0 0% 100%", "dark": "240 12% 10%" },
    "textScale": 1.05
  }
}
```

- `imageUrl`：图片地址（**不要写** `"./grass.jpg"`；在 SPA 的不同路由下会变成相对路径导致 404）
  - 图片放 `public/grass.jpg` → 配 `"/grass.jpg"`
  - 上传资产放 `public/uploads/...` → 配 `"/uploads/..."`（公开站点直接可访问）
- `preload`：是否高优先级加载（默认等同 `true`）
- `blurPx`：模糊半径（0..60）；想“更清晰”就设 `0`
- `opacity`：图片层透明度（0..1）
- `position`：CSS `object-position`（如 `"center"` / `"50% 30%"`）
- `tintOpacity`：强调色光晕叠加强度（0..1）
- `washOpacity`：底部“纸雾/白雾”叠加强度（0..1）；想去雾就调低/设 `0`
- `saturate` / `contrast`：图片滤镜
- `textColor.light` / `textColor.dark`：封面文字颜色覆盖（可写 `"0 0% 100%"` 这种 HSL 三段，也可写 `#fff`/`rgb()`）
- `textScale`：标题/handle/tagline 的字号整体缩放倍率；图片封面下 clamp 到 `0.85..1.25`
