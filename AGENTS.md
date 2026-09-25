# 开发规范（给所有参与开发的人和 AI）

《半亩方塘》：国风治愈的钓鱼养鱼游戏，PC / Steam 单机。动手前先读：

- [docs/game-design.md](docs/game-design.md)：策划大纲（玩什么）
- [docs/production-plan.md](docs/production-plan.md)：技术方案、分工、里程碑（怎么做）
- [docs/art-audio-guide.md](docs/art-audio-guide.md)：美术与音频规范（色板、资源规格）

## 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 开发服务器 http://127.0.0.1:5173/
npm run typecheck    # 类型检查
npm test             # 单元测试（Vitest）
npm run build        # 生产构建（桌面版，字体打包在内）
npm run build:web    # 网页版：输出 dist-web/page.html + assets，用来发布成可以在浏览器里直接玩的页面
npm run shot -- --scene pond --actions "click:900,500;step:2;shot:feed"   # 无头浏览器截图，说明见 tools/screenshot.mjs
```

网址参数：`?scene=pond|fishing|farm|restaurant&seed=7&warmup=10&debug=1&fresh=1`（`shot=1` 为截图模式，由截图脚本使用，不读也不写存档）；网页版拿不到网址参数，用 `#fishing` 这样的锚点直接进某个画面，`#new` 从头开始。
存档写在浏览器 localStorage（`src/app/saveStore.ts`），结构和迁移在 `src/sim/save.ts`。
游戏内：F3 显示调试信息；钓鱼画面里 F2 打开调参面板（遛鱼参数、跳时间、换天气）。

其他工具：

```bash
npm run balance      # 遛鱼数值报告：几种"机器人钓手"跑每种鱼的上鱼率和用时（tools/balance/）
npm run shot -- --scene fishing --actions "down:900,380;step:0.9;up;evalfile:tools/bots/wait-bite.js@90;evalfile:tools/bots/fight.js@40;shot:card"
```

`tools/bots/` 里是截图脚本用的小机器人（等咬钩、遛鱼、拨时间、摆菜地 `farm-demo.js`、小馆备货和营业 `restaurant.js`），可以用 `evalfile:` 动作调用，`@` 后面的参数可以是数字或文字。
`npm run balance` 也会跑一晚上的小馆营业模拟（`tools/balance/restaurant-report.test.ts`）。

**提交前必须通过** `npm run typecheck && npm test`；改了画面的，用 `npm run shot` 截图自己看一遍。

## 目录与分层

```
src/sim/      逻辑层：纯 TypeScript，不能引用 pixi.js、react 或 DOM
src/render/   渲染层：PixiJS（水面、鱼、阿喵、特效、占位道具）
src/scenes/   各个画面（鱼塘、钓鱼、菜地、小馆），组合 sim 和 render
src/ui/       界面层：React，只读状态、只发指令
src/app/      调度层：游戏循环、画面切换、网址参数
data/         配置表（JSON）
tests/        单元测试
tools/        截图、数值模拟、素材处理脚本
assets/raw/   画师和其他 AI 交付的原始素材；处理后的素材放 assets/ 下对应目录
```

## 硬规则

1. **逻辑层（src/sim）不引用任何画面代码**，可以脱离浏览器单独测试。
2. **不用 `Math.random()`**，统一用 `src/sim/rng/rng.ts` 的 `Rng`（可设种子），保证测试和截图可复现。
3. **内容写进配置表**（鱼、渔具、钓点、作物、菜谱、客人、地点……），不要写死在代码里。
4. **存档结构一旦发布就要带版本号和迁移函数**。
5. **颜色从 `src/render/palette.ts` 取**，它和美术指南第 1.2 节保持一致；要改颜色先改文档。
6. **方案 C 的边界**：画面之间只通过"进入参数"（例如哪个钓点的哪个钓位）交接，不要让钓鱼、鱼塘画面依赖"是怎么来到这里的"。

## 代码风格

- TypeScript 严格模式；Prettier：单引号、行宽 100（`.prettierrc.json`）。
- 注释和界面文字用中文；标识符用英文。
- 注释说明"为什么"和不明显的约定（坐标系、单位），不要复述代码。
- 单位：长度为逻辑像素（画面高度固定 1080），时间为秒，角度为弧度。
- 一个文件做一件事；新的渲染部件放在 `src/render/` 下合适的子目录。

## 提交

- 提交信息用英文祈使句开头的标题，正文可以用中文说明原因。
- 不提交 `node_modules/`、`dist/`、`screenshots/`（本地截图目录）。里程碑截图放 `docs/screenshots/`。
