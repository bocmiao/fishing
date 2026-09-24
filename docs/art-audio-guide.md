# 美术与音频指南（给图像 AI / 音乐 AI 的交接文档）

> 配套文档：[策划大纲](game-design.md) · [技术方案与分工](production-plan.md)
>
> **用法**：把对应小节（风格说明 + 某个资源的提示词）复制给图像 AI 或音乐 AI 即可。生成后按第 7 节的规范放进仓库。

---

## 1. 风格定义

**风格名**：国风治愈 · 扁平水彩插画
**英文**：flat illustration with watercolor texture, muted teal palette, Chinese minimalist

### 1.1 七条规则

1. **视角**：场景一律**正上方俯视（90°）**。只有 NPC 立绘和笔记插画例外。
2. **造型**：扁平、简洁、圆润，**不要描边**，或只用极淡的深色边。
3. **质感**：带轻微的水彩 / 水粉颗粒和纸张纹理，边缘可以稍微晕开。
4. **色彩**：大面积使用**低饱和、偏灰的青绿**。鲜艳的颜色（朱红、金黄）只留给鱼，让鱼成为画面焦点。
5. **光影**：柔和的漫射光，光源统一在**左上方**，阴影投向右下方，不要强烈的高光。
6. **干净**：图里不要有文字、水印、边框、人物（立绘除外）。
7. **鱼不进底图**：游戏里的鱼、水波、光斑都是程序画的，**池底和水底图里一定不能画鱼**。

### 1.2 色板（取自参考图，用于对照和校色）

| 用途 | 色值 | |
|---|---|---|
| 水面主色 | `#6A9A84` | 大面积 |
| 浅水、亮部 | `#8AAB92` | |
| 深水、藻斑 | `#4A7A6A` | |
| 最暗处 | `#33584E` | |
| 纸张米白（界面底色） | `#F5EBDB` | |
| 浅灰绿（界面卡片） | `#E6E9DE` | |
| 深青（按钮、强调） | `#1C3A3A` | |
| 墨黑 | `#1E2629` | 鱼的墨斑、文字 |
| 朱红 | `#DD432D` | 锦鲤红斑 |
| 金黄 | `#E4A33B` | 黄金锦鲤、金币 |
| 青灰蓝 | `#4B7079` | 秋翠、浅黄的背部 |
| 鱼白 | `#F4F0E6` | 锦鲤白底 |

### 1.3 字体（全部免费可商用）

| 用途 | 字体 | 授权 |
|---|---|---|
| 标题、正文 | 思源宋体（Source Han Serif） | SIL OFL |
| 外公笔记的手写批注 | 霞鹜文楷（LXGW WenKai） | SIL OFL |
| 英文小标题 | Cormorant Garamond | SIL OFL |

---

## 2. 保持风格一致的方法

AI 出图最大的问题是每张图风格都不一样，按下面的顺序来：

1. **先做主视觉（KEY-001）**：多生成几版，挑出最满意的一张，这张就是全游戏的"风格标准"。
2. **之后每张图都带上这张参考图**：
   - Midjourney：在提示词后加 `--sref <主视觉图片链接>`
   - 即梦：上传主视觉作为"参考图 / 风格参考"
   - GPT 图像：把主视觉和提示词一起发过去，说明"保持这张图的风格"
3. **同一类资源一次性批量生成**，用同样的提示词结构，只改描述的主体。
4. **不要用参考视频（碧潭观鱼）的截图当参考图**，避免生成出和别人作品过于相似、有侵权风险的内容。
5. 轻微的风格差异我会在游戏里用统一调色来弥补，不必追求完美。

---

## 3. 通用风格提示词

每条资源提示词都以这段开头，再接具体描述。

**英文（Midjourney / GPT 图像）**：

```
top-down view, flat illustration, subtle watercolor and gouache texture, paper grain,
muted desaturated teal-green palette, soft diffuse lighting from top-left,
calm and serene, Chinese minimalist aesthetic, clean simple shapes, no outlines,
no text, no watermark, no people
```

**中文（即梦等国产工具）**：

```
正上方俯视视角，扁平插画，淡淡的水彩和水粉质感，纸张纹理，低饱和度青绿色调，
左上方柔和漫射光，宁静治愈，新中式极简美学，造型简洁，无描边，无文字，无水印，无人物
```

---

## 4. 图片资源清单

**优先级**：**P0** = 现在就要（M0、M1）· **P1** = 一天循环版本（M2）· **P2** = 正式版（M4、M5）

**通用规格**：
- 场景底图：3840×2160，PNG
- 物件：**透明背景** PNG，最长边 1024。做不出透明就用纯白背景，我来抠图。
- NPC 立绘：1024×1536，透明背景
- 笔记插画：1536×1024，米白纸底

### P0：现在就要

**KEY-001 主视觉**（锁定风格用，将来也做 Steam 商店图）
> 〔通用提示词〕+ a serene koi pond seen from directly above, a few red-and-white and golden koi swimming, lily pads, mossy stones along the edge, soft caustic light patterns on the pond bed, 16:9
> 生成 4~8 版，挑出最好的一张。这是唯一允许画鱼的图。

**BG-001 鱼塘池底**（生成 3 版：a / b / c）
> 〔通用提示词〕+ top-down view of an empty shallow pond bed seen through clear water, scattered mossy stones, soft green algae patches, sandy areas, gradual depth — slightly darker toward the center, dense moss and plants around the edges, NO fish, NO lily pads, NO reflections, NO ripples, 16:9
> 中文：池塘底部俯视图，透过清澈的水看到池底，零散的青苔石块，柔和的绿色藻斑，沙地，中间稍深稍暗，边缘青苔和水草较密，**不要鱼、不要荷叶、不要倒影、不要波纹**，16:9

**BG-002 小溪水底**
> 〔通用提示词〕+ top-down view of a clear mountain creek bed, rounded river pebbles, a shallow sandy area on one side and a deeper darker pool in the middle, gentle flow direction from top to bottom, grassy banks at left and right edges, NO fish, NO reflections, 16:9

**PROP-001 睡莲叶**（生成 4 片不同形状）
> 〔通用提示词〕+ a single water lily pad seen from directly above, isolated, transparent background

**PROP-002 池边石头**（生成 4 块）
> 〔通用提示词〕+ a single mossy pond stone seen from directly above, isolated, transparent background

### P1：一天循环版本

| 编号 | 内容 | 提示词要点 |
|---|---|---|
| BG-010 | 家园俯瞰图：老宅青瓦屋顶、方塘（**画成空池，我来填水和鱼**）、屋旁荒地（杂草和石头）、竹林、小路 | 我会先出一张**构图线框图**，你连同提示词一起发给 AI 作为参考 |
| BG-011 | 村子地图：手绘地图风，标出老宅、村子、小溪、荷花湖、大河、山涧 | 这张不用俯视照片感，要像**夹在笔记本里的手绘地图**，米白纸底 |
| BG-012 | 荷花湖水底 | 同 BG-001 结构，改成"湖底、较深、有水草区" |
| NPC-001 | 周叔（鱼贩）立绘 | 见下方模板 |
| NPC-002 | 阿婆（杂货铺）立绘 | |
| NPC-003 | 小满（邻居孩子）立绘 | |
| PROP-003 | 荷花（开花）×2、菖蒲 ×2 | 同 PROP-001 结构 |
| PROP-004 | 乌龟（俯视）×1 | 同 PROP-001 结构 |
| BOOK-001~010 | 前 10 种鱼的笔记插画 | 见下方模板 |
| UI-001 | 纸张纹理（可无缝拼接） | seamless cream paper texture, subtle watercolor grain, very light |

**NPC 立绘模板**：
> flat illustration, subtle watercolor texture, muted palette, half-body portrait of 〔人物描述〕, gentle expression, simple clothing of a modern Chinese countryside, soft lighting, clean shapes, transparent background, no text
>
> 人物描述示例：周叔——a friendly middle-aged fishmonger in his 50s, tanned skin, short gray hair, rubber apron, rolled-up sleeves

同一个 NPC 需要的其他表情（开心、惊讶），用第一张立绘作为角色参考图生成。

**笔记插画模板**（侧面，博物志风格，不用俯视）：
> naturalist field-guide illustration of a 〔鱼的英文名〕, side view, watercolor on cream paper, muted natural colors, delicate and minimal, like an old Chinese naturalist's notebook, no text, no background objects
>
> 鱼名对照示例：鲫鱼 crucian carp · 草鱼 grass carp · 鳜鱼 mandarin fish · 马口鱼 Chinese hooksnout carp · 黄颡鱼 yellow catfish

### P2：正式版

- 其余钓点水底：大河渡口、山涧深潭、冰湖（冰面俯视，可凿洞）、外公的秘密钓点
- NPC-004~006：老韩、林先生、村长
- 其余约 30 种鱼的笔记插画；6 条传说鱼的插画（风格更神秘，可以加一点金色或墨色晕染）
- 装饰物件约 40 件：石灯笼、小石桥、汀步、假山、竹筒流水、水车、奖杯……
- **Logo**：书法风格的"半亩方塘"标题字（即梦、GPT 图像的中文字效果较好；或者用可商用的书法字体）
- **Steam 商店图**（尺寸以 Steamworks 后台当时的要求为准）：
  - 页头图 920×430 · 小图 462×174 · 主图 1232×706 · 竖版 748×896
  - 游戏库封面 600×900 · 游戏库主视觉 3840×1240 · 透明 Logo

> 界面图标（饵料、渔具、饲料等）和游戏里的鱼都由我用代码绘制，**不需要**图像 AI 生成。

---

## 5. 背景音乐

**整体风格**：古筝、竹笛、琵琶、钢琴，点缀大提琴或环境音垫；慢速（60~80 BPM）；纯音乐，不要人声（主题曲可以考虑轻声哼唱）。

**通用提示词**（Suno / Udio 的风格栏）：

```
instrumental, Chinese guzheng and bamboo flute, soft felt piano, gentle ambient pads,
peaceful, pastoral, slow tempo, warm lo-fi texture, no vocals
```

| 编号 | 用途 | 情绪 | 时长 | 在通用提示词后追加 |
|---|---|---|---|---|
| MUS-01 | 标题画面主题曲 | 温暖、怀念、微微感伤 | 2~3 分钟 | nostalgic, heartfelt, main theme melody |
| MUS-02 | 春·白天 | 轻快、清新 | 3 分钟 | spring morning, light and fresh, birdsong feel |
| MUS-03 | 夏·白天 | 慵懒、明亮 | 3 分钟 | lazy summer afternoon, bright, relaxed |
| MUS-04 | 秋·白天 | 温柔、略带寂寥 | 3 分钟 | autumn, mellow, slightly wistful, pipa |
| MUS-05 | 冬·白天 | 安静、空灵 | 3 分钟 | winter, sparse, quiet, crystalline piano |
| MUS-06 | 夜晚 | 静谧 | 3 分钟 | night, very calm, soft cello drone, crickets feel |
| MUS-07 | 雨天 | 沉静、治愈 | 3 分钟 | rainy day, contemplative, soft |
| MUS-08 | 鱼塘观鱼 | **全游戏最安静**，适合长时间挂着 | 4~5 分钟 | minimal, meditative, ambient, very slow, zen |
| MUS-09 | 遛鱼 | 轻快、有一点紧张，但不能吵 | 1~2 分钟 | playful tension, light percussion, upbeat but gentle |
| MUS-10 | 村子 | 热闹、有人情味 | 3 分钟 | village market, cheerful, warm, folk |
| MUS-11 | 锦鲤品评会 | 隆重、优雅 | 2 分钟 | elegant, ceremonial, festive but refined |
| MUS-12 | 传说鱼出现 | 神秘、庄重 | 1~2 分钟 | mysterious, awe, deep, legendary |

**要求**：
- 每首多生成几版挑最好的，**下载无损 WAV**。
- 不用自己剪循环，我会在代码里设置循环点和淡入淡出。

---

## 6. 音效

**来源**：ElevenLabs 音效（输入文字描述生成），或免费音效库（Freesound 上选 **CC0** 授权的、Sonniss 每年免费发布的 GDC 音效包）。

| 编号 | 音效 | 描述（可直接当提示词） | 循环 |
|---|---|---|---|
| **钓鱼** | | | |
| SFX-001 | 抛竿 | fishing rod cast, line whoosh | |
| SFX-002 | 浮漂入水 | small float plopping into calm water | |
| SFX-003 | 浮漂轻颤 | tiny subtle water tick, fish nibbling | |
| SFX-004 | 咬钩 | float pulled underwater, quick splash | |
| SFX-005 | 收线 | fishing reel clicking, steady | ✅ |
| SFX-006 | 放线 | fishing reel spinning out fast | ✅ |
| SFX-007 | 鱼挣扎水花 | fish thrashing at surface, splashes | |
| SFX-008 | 断线 | fishing line snapping | |
| SFX-009 | 上鱼 | fish pulled out of water, big splash, satisfying | |
| SFX-010 | 新纪录 / 新图鉴 | gentle chime, magical sparkle | |
| SFX-011 | 放生 | fish released into water, soft splash | |
| **鱼塘** | | | |
| SFX-020 | 撒饲料 | handful of fish pellets scattering on water | |
| SFX-021 | 鱼群抢食 | many koi gulping at the water surface | |
| SFX-022 | 捞网 | net scooping through water | |
| SFX-023 | 竹筒流水（惊鹿） | bamboo shishi-odoshi knock | |
| **环境** | | | |
| SFX-030 | 小溪流水 | gentle creek flowing | ✅ |
| SFX-031 | 湖边 | calm lake shore, light wind, reeds | ✅ |
| SFX-032 | 大河 | wide river flowing | ✅ |
| SFX-033 | 雨 | light rain on water surface | ✅ |
| SFX-034 | 雷雨 | heavy rain with distant thunder | ✅ |
| SFX-035 | 白天鸟鸣 | countryside birds chirping | ✅ |
| SFX-036 | 夏夜虫鸣 | summer night crickets and frogs | ✅ |
| SFX-037 | 冬风 | soft winter wind | ✅ |
| **界面** | | | |
| SFX-040 | 翻页 | old paper notebook page turning | |
| SFX-041 | 按钮 | soft wooden click | |
| SFX-042 | 金币 | coins clinking, pleasant | |
| SFX-043 | 打开面板 | soft paper slide | |

---

## 7. 交付规范

1. **放哪里**：`assets/raw/images/`、`assets/raw/music/`、`assets/raw/sfx/`
2. **怎么命名**：用清单编号，多个版本加后缀，例如 `BG-001_a.png`、`MUS-02_v2.wav`
3. **格式**：
   - 图片：PNG，要透明的尽量真透明（做不到就纯白背景）
   - 音频：WAV，或最高码率 MP3
4. **附带说明**：每个文件配一个同名 `.txt`，写明用了哪个工具、哪条提示词、生成日期。这是将来 Steam AI 内容声明的依据，也方便以后重新生成。
5. **告诉我**：放好后通知我，我来做后期处理（抠图、裁切、压缩、音量统一、格式转换）并接入游戏。

---

## 8. 版权与 AI 内容声明

- **商用授权**：大多数 AI 工具要**付费订阅**才能商用，生成前请确认各工具的最新条款。
- **Steam 声明**：Steam 要求开发者在提交时的"内容调查"里**如实声明** AI 生成的内容，第 7 节的 `.txt` 记录就是为这个准备的。
- **原创性**：参考作品只借鉴风格，不照搬它的画面、界面和文案。
- **字体**：只用第 1.3 节列出的免费可商用字体，不要用来源不明的字体。
