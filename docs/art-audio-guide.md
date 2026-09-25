# 美术与音频指南（给画师 / 图像 AI / 音乐 AI 的交接文档）

> 配套文档：[策划大纲](game-design.md) · [技术方案与分工](production-plan.md)
>
> **用法**：把对应小节（风格说明 + 某个资源的提示词或约稿说明）复制给画师、图像 AI 或音乐 AI 即可。生成后按第 8 节的规范放进仓库。

---

## 1. 风格定义

**风格名**：国风治愈 · 扁平水彩插画
**英文**：flat illustration with watercolor texture, muted teal palette, Chinese minimalist

### 1.1 规则

1. **视角按资源类型区分**：

   | 资源 | 视角 |
   |---|---|
   | 池底、钓点水底（含底部的岸边）、浮在水面的东西（睡莲、荷叶）、俯视阿喵 | **正上方俯视（90°）** |
   | 场景插画（老宅院子、集市）、摊位后的 NPC 小人 | **3/4 俯视**：同时看得到正面和顶面，像星露谷、动森那样 |
   | 对话立绘、举鱼插画、笔记插画、老宅室内、地图 | 正常的平视插画 |
   | 方案 C 才需要：地面纹理、立着的物件、三朝向行走角色 | 地面正俯视，物件和角色 3/4 俯视 |

2. **描边**：场景和物件**不描边**；角色可以用**细的深色描边**（深棕或墨绿，不用纯黑），让角色从背景里跳出来。
3. **造型**：扁平、简洁、圆润。
4. **质感**：带轻微的水彩 / 水粉颗粒和纸张纹理，边缘可以稍微晕开。
5. **色彩**：大面积使用**低饱和、偏灰的青绿**。鲜艳的颜色（朱红、金黄）留给鱼和主角的点缀，让它们成为画面焦点。
6. **光影**：柔和的漫射光，光源统一在**左上方**，阴影投向右下方，不要强烈的高光。
7. **干净**：图里不要有文字、水印、边框。
8. **鱼不进底图**：游戏里的鱼、水波、光斑都是程序画的，**池底和水底图里一定不能画鱼**。

### 1.2 色板

**场景和界面**（取自参考图）：

| 用途 | 色值 |
|---|---|
| 水面主色 | `#6A9A84` |
| 浅水、亮部 | `#8AAB92` |
| 深水、藻斑 | `#4A7A6A` |
| 最暗处 | `#33584E` |
| 纸张米白（界面底色） | `#F5EBDB` |
| 浅灰绿（界面卡片） | `#E6E9DE` |
| 深青（按钮、强调） | `#1C3A3A` |

**鱼和主角**：

| 用途 | 色值 |
|---|---|
| 墨黑（鱼的墨斑、猫的黑毛、文字） | `#1E2629` |
| 鱼白 / 猫的白毛 | `#F4F0E6` |
| 朱红（锦鲤红斑、浮漂） | `#DD432D` |
| 金黄（黄金锦鲤、金币） | `#E4A33B` |
| 青灰蓝（秋翠、浅黄的背部） | `#4B7079` |
| 靛蓝（阿喵的外套，比品牌版稍灰） | `#44557A` |
| 草黄（草帽） | `#C9A36B` |
| 竹黄（鱼竿） | `#D2A24C` |
| 米白（内衫） | `#EDE4D0` |
| 粉（鼻子、耳朵内侧） | `#E8A596` |

**田地与作物**（菜地画面）：

| 用途 | 色值 |
|---|---|
| 草地 | `#6D8A58` |
| 草地亮部 | `#8AA46C` |
| 草地暗部 | `#4F6B44` |
| 干土（开过荒的地） | `#9C7A56` |
| 熟土（翻好的地） | `#7A5A3E` |
| 湿土（浇过水） | `#5A4030` |
| 嫩芽绿 | `#9CC06A` |
| 叶子绿 | `#6E9A4E` |
| 深叶绿（葱、叶子背光面） | `#4F7A3A` |
| 麦黄 | `#D9B76A` |
| 蚯蚓粉 | `#D98C7A` |

### 1.3 字体（全部免费可商用）

| 用途 | 字体 | 授权 |
|---|---|---|
| 标题、正文 | 思源宋体（Source Han Serif） | SIL OFL |
| 外公笔记的手写批注 | 霞鹜文楷（LXGW WenKai） | SIL OFL |
| 英文小标题 | Cormorant Garamond | SIL OFL |

---

## 2. 主角阿喵

### 2.1 两个版本

| 版本 | 文件 | 用途 |
|---|---|---|
| 品牌版 | [`assets/reference/cat-brand.webp`](../assets/reference/cat-brand.webp)（已有） | Miao.Club 标志、Steam 头像、周边。**保持原样不动** |
| 游戏版 | 待制作 | 钓鱼和鱼塘画面里的俯视阿喵、举鱼插画、对话立绘；以后方案 C 的行走角色 |

### 2.2 游戏版要保留的设计要素

- **奶牛猫**：头顶和耳朵黑色，脸下半部和胸口白色，**白手套爪子**，粉鼻子，耳朵内侧粉色
- **黑色方框墨镜**（标志性，一直戴着）
- **编织草帽**，帽檐有磨损破口
- **靛蓝色外套**，袖子上有灰色补丁
- **米白色中式立领内衫**，深蓝色盘扣
- **竹鱼竿**，缠绳结，红白浮漂
- 神态：淡定、高冷

### 2.3 游戏版要改的地方

| 品牌版 | 游戏版 |
|---|---|
| 粗黑描边 | 细描边，深棕或墨绿色 |
| 细致的毛发笔触 | 简化成干净的色块 |
| 高饱和配色 | 往第 1.2 节色板靠（外套稍灰、白色偏暖） |
| 胸像 | 全身，**Q 版比例**，头大身小，头身比约 1 : 1.2 ~ 1 : 1.5 |

### 2.4 方案 B 的交付物（现在需要）

**CHAR-T01 俯视阿喵拆件**

阿喵坐在画面底部的岸边、面朝水面（画面上方），从**正上方**往下看。看得到的是：圆草帽的顶面、从帽檐下露出的两只黑耳朵、靛蓝外套的肩背、伸向前方的两只白手套爪子，以及绕在身旁的尾巴。

| 部件 | 说明 |
|---|---|
| 草帽 | 俯视是一个圆，帽檐的磨损破口要看得出来 |
| 左耳、右耳 | 从帽檐下露出，独立，用来做表情 |
| 身体 | 外套的肩背，含袖子上的补丁 |
| 左爪、右爪 | 白手套，握竿用 |
| 尾巴 | 分 3 段，用来做摆尾 |
| 竹竿 | 单独一张，横放，竿尖朝上；红白浮漂单独一张 |
| 饲料袋 | 单独一张（撒饲料动作用） |

规格：画布 1024×1024，所有部件导出为透明 PNG，**每个部件都保持在画布上的原位**（叠在一起就是完整的阿喵），关节处多画一截，被挡住的部分也画完整。也可以直接交分层 PSD。

**CHAR-003 对话立绘**
- 半身，平视角度，透明背景，1024×1536
- 5 种表情：平静、开心、惊讶、得意、失落
- 眼睛被墨镜挡住，**表情靠耳朵、嘴、墨镜的角度和脸颊红晕来表达**

**CHAR-004 举鱼插画**（上鱼时的特写）
- 阿喵开心地把鱼举起来，平视，透明背景，1536×1536
- **鱼不要画**：鱼由代码画进去，所以每种鱼都能被举起来。请分两层交付：阿喵本体一层、握鱼的两只爪子一层（爪子盖在鱼上面），鱼的位置空出来
- 2 个版本：小鱼（单手拎起）、大鱼（双手抱着，吃力但得意）

### 2.5 方案 C 的交付物（以后需要）

**CHAR-001 三视图**（先交这个，确认形象）
- 正面（面朝下）、背面（面朝上）、侧面（面朝右，向左走时镜像翻转），3/4 俯视角度
- 站立的中性姿势，双手自然下垂，**不拿鱼竿和秧苗**（道具单独画）

**CHAR-002 拆件**（三视图确认后再做，给代码做骨骼动画用）

每个朝向一套，拆成以下部件：

| 部件 | 说明 |
|---|---|
| 头 | 包含脸部底色 |
| 左耳、右耳 | 独立，用来做表情（竖起、耷拉、转动） |
| 墨镜 | 独立，用来做反光和小动作 |
| 嘴 | 3 种嘴型：闭嘴、微笑、张嘴（正面、侧面需要，背面不需要） |
| 草帽 | 独立（打盹时可以盖在脸上，风大时会晃） |
| 身体 | 外套 + 内衫 |
| 左上臂、左前臂（含爪子） | 手臂分两段，用来做抛竿动作 |
| 右上臂、右前臂（含爪子） | 同上 |
| 左腿、右腿 | |
| 尾巴 | 分 3 段，用来做摆尾 |
| 道具 | 竹竿（竿身和浮漂分开）、捞网、饲料袋；后期：秧苗、锄头、水壶 |

**拆件规格（很重要，关系到动画能不能做）**：
1. 每个朝向一张画布，尺寸 **2048×2048**，所有部件导出为透明 PNG，**每个部件都保持在画布上的原位**（叠在一起就是完整的角色）。也可以直接交分层 PSD。
2. **关节处多画一截**：比如上臂和身体、前臂和上臂的连接处要有重叠，转动时才不会露出缝隙。
3. **被挡住的部分也要画完整**：比如被身体挡住的那截手臂。
4. 每个部件告诉我大概的**转轴位置**（比如肩膀、手肘、尾巴根部），标在一张示意图上即可，不标我也能自己判断。

### 2.6 制作路线

**方案 B 的素材（CHAR-T01、CHAR-003、CHAR-004）**：造型简单，**图像 AI 就能胜任**，也可以顺便请画师一起画。用图像 AI 时，把品牌图作为角色参考，参考提示词：

> CHAR-T01：the same cat character as the reference image, seen from directly above while sitting at the bottom edge of the frame facing up toward a pond: we see only the round top of a worn woven straw hat, two black cat ears poking out from under the brim, the shoulders and back of an indigo jacket with a gray sleeve patch, two white paws reaching forward, and a black-and-white tail curled beside it. Flat illustration, subtle watercolor texture, thin dark brown outlines, muted palette, plain white background, no text
>
> CHAR-004：the same cat character as the reference image, cheerful, holding up something with both paws above its chest (leave the held object empty), half-body, eye-level view, flat illustration, subtle watercolor texture, thin dark brown outlines, muted palette, plain white background, no text

生成后在免费的在线修图工具 Photopea 里按第 2.4 节拆分图层；拆不好也没关系，把整张图给我，我来判断怎么处理。

**方案 C 的素材（CHAR-001、CHAR-002）**：三视图和行走拆件难度高，**推荐请画师**。可以在米画师等约稿平台发布需求，下面这段可以直接当约稿说明：

> 需要为一款国风治愈的钓鱼养鱼游戏绘制主角：一只拟人的奶牛猫。已有品牌形象图（附件），需要改成游戏画风：扁平水彩插画风格、细深色描边、低饱和配色、Q 版全身。
> 交付：① 3/4 俯视角度的三视图（正面、背面、侧面）；② 每个朝向的拆件（部件清单和规格见附件文档第 2.5 节），用于程序骨骼动画；③（如果方案 B 的素材还没做）俯视拆件、举鱼插画、半身对话立绘 5 种表情。
> 用途：商业游戏（Steam），需要商用授权。
>
> （附件：品牌图 `cat-brand.webp`、本文档第 1 节和第 2 节、场景风格参考 KEY-001）

预算紧也可以用图像 AI 出三视图，参考提示词：

> character turnaround sheet of the same cat character in the reference image: an anthropomorphic tuxedo cat wearing black square sunglasses, a worn woven straw hat, an indigo jacket with a gray patch on the sleeve, and a cream Chinese mandarin-collar shirt with dark blue frog buttons. Chibi full-body proportions with a big head. Front view, back view and side view, 3/4 top-down angle, neutral standing pose, arms relaxed. Flat illustration, subtle watercolor texture, thin dark brown outlines, muted palette, plain white background, no text

但三个朝向拆件的工作量大、需要修图基础，可以先试一个朝向，不顺利再改请画师。

**不管走哪条路线**，素材到位前我都会先用代码画的占位猫开发，不耽误进度。

---

## 3. 保持风格一致的方法

AI 出图最大的问题是每张图风格都不一样，按下面的顺序来：

1. **先做场景主视觉（KEY-001）**：多生成几版，挑出最满意的一张，这张就是全游戏场景的"风格标准"。
2. **之后每张场景图都带上这张参考图**：
   - Midjourney：在提示词后加 `--sref <主视觉图片链接>`
   - 即梦：上传主视觉作为"参考图 / 风格参考"
   - GPT 图像：把主视觉和提示词一起发过去，说明"保持这张图的风格"
3. **角色类（NPC）以阿喵的游戏版形象（立绘或举鱼插画）作为风格参考**，保证所有角色像同一个世界的。
4. **同一类资源一次性批量生成**，用同样的提示词结构，只改描述的主体。
5. **不要用参考视频（碧潭观鱼）的截图当参考图**，避免生成出和别人作品过于相似、有侵权风险的内容。
6. 轻微的风格差异我会在游戏里用统一调色来弥补，不必追求完美。

---

## 4. 通用风格提示词

按资源类型选一段作为开头，再接具体描述。

**A. 俯视类**（池底、钓点水底、水面物件；方案 C 的地面纹理）

```
top-down view, flat illustration, subtle watercolor and gouache texture, paper grain,
muted desaturated teal-green palette, soft diffuse lighting from top-left,
calm and serene, Chinese minimalist aesthetic, clean simple shapes, no outlines,
no text, no watermark, no characters
```

> 中文：正上方俯视视角，扁平插画，淡淡的水彩和水粉质感，纸张纹理，低饱和度青绿色调，左上方柔和漫射光，宁静治愈，新中式极简美学，造型简洁，无描边，无文字，无水印，无角色

**B. 3/4 类**（场景插画；方案 C 的树、房子、摊位等单个物件）

```
3/4 top-down view showing both the front and the top of the object, like a cozy
top-down farming game but NOT pixel art, flat illustration, subtle watercolor and
gouache texture, paper grain, muted desaturated palette, soft diffuse lighting from
top-left, rural southern Chinese countryside, clean simple shapes, no outlines,
single isolated object, transparent background, no text, no watermark
```

> 中文：3/4 俯视视角，同时看得到物体的正面和顶面，像俯视角的田园游戏但不是像素风，扁平插画，淡淡的水彩和水粉质感，纸张纹理，低饱和度配色，左上方柔和漫射光，中国南方乡村，造型简洁，无描边，单个物体，透明背景，无文字，无水印
>
> 用于**整张场景插画**时，把 single isolated object, transparent background（单个物体，透明背景）换成场景描述和画幅比例。

---

## 5. 图片资源清单

**优先级**：**P0** = 现在就要（M0、M1）· **P1** = 一天循环、菜地和小馆（M2~M4）· **P2** = 正式版（M6、M7）· **方案 C** = 行走版（M9）

**通用规格**：
- 池底：3840×2160，PNG
- 钓点水底：**宽幅**，约 7680×2160（32:9），底部约 15% 是岸边。每个钓位就是镜头在这张宽图上的一个位置。工具出不了这么宽，就生成两三张 16:9 的相邻画面，我来拼接
- 场景插画：3840×2160，PNG
- 物件：**透明背景** PNG，最长边 1024。做不出透明就用纯白背景，我来抠图。
- NPC 立绘：1024×1536，透明背景
- 笔记插画：1536×1024，米白纸底

### P0：现在就要

| 编号 | 内容 | 提示词（接在通用提示词后） |
|---|---|---|
| **KEY-001** | 场景主视觉，锁定风格用，**不含角色** | 〔A〕+ a serene koi pond seen from directly above, a few red-and-white and golden koi swimming, lily pads, mossy stones along the edge, soft caustic light patterns on the pond bed, 16:9。生成 4~8 版挑一张；这是唯一允许画鱼的场景图 |
| **BG-001** | 鱼塘池底 ×3（a / b / c） | 〔A〕+ an empty shallow pond bed seen through clear water, scattered mossy stones, soft green algae patches, sandy areas, slightly darker toward the center, dense moss and plants around the edges, NO fish, NO lily pads, NO reflections, NO ripples, 16:9 |
| **BG-002** | 小溪钓点水底（宽幅） | 〔A〕+ a wide panorama of a clear mountain creek seen from directly above, rounded river pebbles, shallow sandy areas and deeper darker pools, a few waterweed patches, gentle flow from left to right, the bottom edge of the image is a grassy creek bank with a few flat stones, NO fish, NO reflections, 32:9 |
| **PROP-001** | 睡莲叶 ×4 | 〔A〕+ a single water lily pad, isolated, transparent background |
| **PROP-002** | 池边石头 ×4 | 〔A〕+ a single mossy stone, isolated, transparent background |

### P1：一天循环版本

| 编号 | 内容 | 提示词要点 |
|---|---|---|
| CHAR-T01 | 俯视阿喵拆件 | 见第 2 节 |
| CHAR-003 | 阿喵对话立绘 5 种表情 | 见第 2 节 |
| CHAR-004 | 阿喵举鱼插画 ×2 | 见第 2 节 |
| KEY-002 | 带主角的主视觉：阿喵坐在锦鲤池边钓鱼 | 以 KEY-001 为风格参考、品牌图为角色参考；将来做 Steam 商店图 |
| SCENE-001 | 老宅院子插画：青瓦白墙的南方老房子、屋后的方塘（**画成空池，我来填水和鱼**）、屋旁长满杂草和石头的荒地、竹林、通往村子的小路 | 〔B〕+ 场景描述，16:9。方塘、屋门、荒地、小路都要能点击，所以**彼此不要重叠** |
| SCENE-002 | 柳溪村集市插画：露天集市，4 个摊位（鱼摊、杂货摊、渔具摊、公告栏），**摊位后面空着**（NPC 单独画、叠上去） | 〔B〕+ a small open-air village market with four stalls with cloth awnings, 16:9 |
| NPC-001~003 | 周叔（水獭）、阿婆（仓鼠）、小满（柴犬）：各一张**摊位小人**（3/4 正面，上半身露在摊位后面）+ 一张**对话立绘** | 见下方模板；以阿喵的游戏版形象为风格参考 |
| ROOM-001 | 老宅室内插画：床、旧收音机、摆着笔记本的木桌、奖杯架、窗外看得到方塘 | 平视插画，16:9；这些物品要能点击，所以**彼此不要重叠** |
| MAP-001 | 村子地图：标出老宅、柳溪村、小溪、荷花湖、大河、山涧 | 像**夹在笔记本里的手绘地图**，米白纸底，不用俯视照片感 |
| BG-012 | 荷花湖水底 | 同 BG-001 结构，改为"lake bed, deeper, with waterweed areas" |
| PROP-003 | 荷花（开花）×2、菖蒲 ×2 | 同 PROP-001 结构 |
| PROP-004 | 乌龟（俯视）×1 | 〔A〕+ a small pond turtle seen from directly above, isolated, transparent background |
| BOOK-001~010 | 前 10 种鱼的笔记插画 | 见下方模板 |
| UI-001 | 纸张纹理（可无缝拼接） | seamless cream paper texture, subtle watercolor grain, very light |
| BG-020 | 菜地地面（俯视）：松软的深色泥土、几道垄沟、地头有石头和杂草，**不画作物** | 〔A〕+ a small vegetable garden plot seen from directly above, soft dark tilled soil in rows, a few stones and weeds at the edges, NO plants in the rows, 16:9 |
| PROP-010 | 作物俯视图：玉米、小麦、黄豆、葱蒜、青菜，每种 3 个生长阶段（苗、半大、成熟） | 同 PROP-001 结构，seen from directly above；共 15 张 |
| SCENE-003 | 喵记小馆插画：乡村小饭馆内景，灶台、活鱼缸、四五张木桌、墙上挂鱼拓的位置空着，**桌边空着**（客人单独画、叠上去） | 〔B〕+ a cozy small countryside Chinese eatery interior, wood stove, a live fish tank, four wooden tables, 16:9 |
| NPC-C01~04 | 小馆客人小人（坐姿，3/4 正面）：兔子、鸭子、老水牛村长、城里来的美食博主（狐狸） | NPC 模板 + sitting at a table |

**NPC 模板**：
> flat illustration, subtle watercolor texture, thin dark brown outlines, muted palette, an anthropomorphic 〔动物〕 character, 〔身份和外观〕, chibi proportions matching the reference character, gentle expression, simple modern Chinese countryside clothing, transparent background, no text
>
> 摊位小人追加：upper body, 3/4 top-down view, front facing
> 对话立绘追加：half-body portrait, eye-level view
>
> 示例：周叔——an otter, a friendly middle-aged fishmonger, rubber apron, rolled-up sleeves

NPC 平时只站在摊位后面做待机动作，摊位小人**不需要拆件**，交一张完整的图即可，简单的起伏和摆尾我用代码实现。

**笔记插画模板**（侧面，博物志风格）：
> naturalist field-guide illustration of a 〔鱼的英文名〕, side view, watercolor on cream paper, muted natural colors, delicate and minimal, like an old Chinese naturalist's notebook, no text, no background objects
>
> 鱼名对照示例：鲫鱼 crucian carp · 草鱼 grass carp · 鳜鱼 mandarin fish · 马口鱼 Chinese hooksnout carp · 黄颡鱼 yellow catfish

### P2：正式版

- 其余钓点的宽幅水底：大河渡口、山涧深潭、冰湖（冰面俯视，可凿洞）、外公的秘密钓点
- NPC-004~006：老韩（苍鹭）、林先生（丹顶鹤）、村长（老水牛）
- 其余约 30 种鱼的笔记插画；6 条传说鱼的插画（风格更神秘，可以加一点金色或墨色晕染）
- 鱼塘装饰约 40 件：石灯笼、小石桥、汀步、假山、竹筒流水、水车、奖杯……
- **Logo**：书法风格的"半亩方塘"标题字（即梦、GPT 图像的中文字效果较好；或者用可商用的书法字体）
- **Steam 商店图**（尺寸以 Steamworks 后台当时的要求为准，画面都应该**以阿喵为主角**）：
  - 页头图 920×430 · 小图 462×174 · 主图 1232×706 · 竖版 748×896
  - 游戏库封面 600×900 · 游戏库主视觉 3840×1240 · 透明 Logo

> 界面图标（饵料、渔具、饲料等）和游戏里的鱼都由我用代码绘制，**不需要**画师或图像 AI 制作。

### 方案 C：行走版（M9 再做）

| 编号 | 内容 | 提示词要点 |
|---|---|---|
| CHAR-001、CHAR-002 | 阿喵三视图 + 行走拆件 | 见第 2 节，推荐请画师 |
| NPC 场景小人 | 6 个 NPC 的全身站姿（3/4 正面） | NPC 模板 + full body, 3/4 top-down view, front facing, standing |
| TEX-001 | 草地纹理 | 〔A〕+ seamless tileable texture of short soft grass, a few tiny wildflowers, square（1024×1024，可无缝拼接，下同） |
| TEX-002 | 泥土路纹理 | 〔A〕+ seamless tileable texture of a packed earth country path, small pebbles, square |
| TEX-003 | 石板路纹理 | 〔A〕+ seamless tileable texture of old gray flagstones with moss in the gaps, square |
| TEX-004 | 河滩沙地纹理 | 〔A〕+ seamless tileable texture of damp riverside sand with small shells and pebbles, square |
| OBJ-001 | 老宅外观：青瓦白墙的南方老房子，带小院 | 〔B〕+ an old southern Chinese farmhouse with gray tiled roof and white walls, small courtyard gate |
| OBJ-002 | 树木：柳树、竹丛、桂花树、枫树（秋），各 2 版 | 〔B〕+ a single 〔树名〕 tree |
| OBJ-003 | 院子物件：篱笆（可拼接）、木桥、石阶、长椅、水缸、晾衣竹竿、柴堆 | 〔B〕+ 〔物件名〕 |
| OBJ-004 | 集市摊位 ×4：鱼摊、杂货摊、渔具摊、公告栏 | 〔B〕+ a small open-air village market stall selling 〔货物〕, with a cloth awning |

---

## 6. 背景音乐

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
| MUS-10 | 村子集市 | 热闹、有人情味 | 3 分钟 | village market, cheerful, warm, folk |
| MUS-11 | 锦鲤品评会 | 隆重、优雅 | 2 分钟 | elegant, ceremonial, festive but refined |
| MUS-12 | 传说鱼出现 | 神秘、庄重 | 1~2 分钟 | mysterious, awe, deep, legendary |

**要求**：
- 每首多生成几版挑最好的，**下载无损 WAV**。
- 不用自己剪循环，我会在代码里设置循环点和淡入淡出。

---

## 7. 音效

**来源**：ElevenLabs 音效（输入文字描述生成），或免费音效库（Freesound 上选 **CC0** 授权的、Sonniss 每年免费发布的 GDC 音效包）。

| 编号 | 音效 | 描述（可直接当提示词） | 循环 |
|---|---|---|---|
| **阿喵** | | | |
| SFX-050 | 短喵（打招呼） | a short friendly cat meow | |
| SFX-051 | 满足的喵（上鱼时） | a pleased, satisfied cat meow | |
| SFX-052 | 惊讶的喵 | a surprised short cat chirp | |
| SFX-053 | 呼噜（打盹） | a cat purring softly | ✅ |
| SFX-054 | 脚步·草地（方案 C） | soft paw footsteps on grass, several variations | |
| SFX-055 | 脚步·泥土（方案 C） | soft paw footsteps on dirt path, several variations | |
| SFX-056 | 脚步·石板（方案 C） | soft paw footsteps on stone, several variations | |
| SFX-057 | 脚步·木桥（方案 C） | soft paw footsteps on wooden planks, several variations | |
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
| SFX-023 | 竹筒流水（惊鹿） | bamboo water fountain knock | |
| **环境** | | | |
| SFX-030 | 小溪流水 | gentle creek flowing | ✅ |
| SFX-031 | 湖边 | calm lake shore, light wind, reeds | ✅ |
| SFX-032 | 大河 | wide river flowing | ✅ |
| SFX-033 | 雨 | light rain on water surface | ✅ |
| SFX-034 | 雷雨 | heavy rain with distant thunder | ✅ |
| SFX-035 | 白天鸟鸣 | countryside birds chirping | ✅ |
| SFX-036 | 夏夜虫鸣 | summer night crickets and frogs | ✅ |
| SFX-037 | 冬风 | soft winter wind | ✅ |
| SFX-038 | 集市人声 | gentle village market chatter, distant | ✅ |
| **界面** | | | |
| SFX-040 | 翻页 | old paper notebook page turning | |
| SFX-041 | 按钮 | soft wooden click | |
| SFX-042 | 金币 | coins clinking, pleasant | |
| SFX-043 | 打开面板 | soft paper slide | |

> **猫叫声建议用真实录音**：AI 生成的猫叫常常不自然。如果身边有猫，用手机在安静的房间录几段就很好；或者从音效库里挑高质量的。上鱼时那声"喵"会成为游戏和 Miao.Club 的声音标识，值得认真挑。

---

## 8. 交付规范

1. **放哪里**：`assets/raw/images/`、`assets/raw/character/`（主角和 NPC）、`assets/raw/music/`、`assets/raw/sfx/`
2. **怎么命名**：用清单编号，多个版本加后缀，例如 `BG-001_a.png`、`CHAR-002_front_tail1.png`、`MUS-02_v2.wav`
3. **格式**：
   - 图片：PNG，要透明的尽量真透明（做不到就纯白背景）；拆件也可以交 PSD
   - 音频：WAV，或最高码率 MP3
4. **附带说明**：每个文件（或每批文件）配一个同名 `.txt`，写明来源：
   - AI 生成：用了哪个工具、哪条提示词、生成日期
   - 画师作品：画师名、约稿平台、授权范围
   
   这是将来 Steam AI 内容声明和版权证明的依据，也方便以后重新生成。
5. **告诉我**：放好后通知我，我来做后期处理（抠图、裁切、压缩、音量统一、格式转换）并接入游戏。

---

## 9. 版权与 AI 内容声明

- **商用授权**：大多数 AI 工具要**付费订阅**才能商用，生成前请确认各工具的最新条款。
- **画师约稿**：合同里写明"商业游戏使用、可用于宣传和周边"，避免以后纠纷。
- **Steam 声明**：Steam 要求开发者在提交时的"内容调查"里**如实声明** AI 生成的内容，第 8 节的 `.txt` 记录就是为这个准备的。
- **原创性**：参考作品只借鉴风格，不照搬它的画面、界面和文案。
- **字体**：只用第 1.3 节列出的免费可商用字体，不要用来源不明的字体。
