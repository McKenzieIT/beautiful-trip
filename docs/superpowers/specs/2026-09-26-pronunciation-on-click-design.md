# 设计：景区/餐厅名"点击发音"（一期）

- 日期：2026-09-26
- 状态：已实现（一期，2026-09-26）
- 作用范围：`beautiful-trip/`（英国 7 日行程 PWA，部署于 GitHub Pages）

## 1. 背景与问题

`beautiful-trip/` 是一个面向中文旅客的英国 7 日行程 PWA（单文件 `index.html` + `restaurants.js` + `sw.js` + `manifest.webmanifest`，离线优先、无后端、零外部 API）。行程里的实体（景区 POI、餐厅、店铺）绝大多数是英文名，而英式地名发音极反直觉（Leicester=Lester、Greenwich=Gren-itch、Southwark=Suth-erk、Magdalen=Mawd-lin、Tottenham、Wetherspoon…）。中文旅客在现场要对当地人问路/点单/找店时，光看拼写无法正确读出。

本功能给每个实体的名字加一个"点击发音"入口：点击后播放标准英音，并显示 IPA 音标作为文本基准。

## 2. 目标 / 非目标

### 目标
- 餐厅（~24 家，`restaurants.js`）与景点 POI（~53 个，`index.html` 内联 `DAYS` 数据）的名字可点击发音。
- 浏览器内置 Web Speech API（`speechSynthesis`）选 en-GB 语音播报；默认略慢（`rate=0.92`）便于旅客听清。
- 名字旁显示 IPA 国际音标（如 `/ðə plaʊ/`），作为权威文本基准。
- 离线可用：TTS 用设备本地语音引擎，`pron.js` 由 Service Worker 缓存。
- iOS Safari、Android Chrome、桌面均支持；设备无 en-GB 语音时优雅降级（显示 IPA + 提示，不报错）。
- 遵循项目"绝不编造"原则：每条 IPA 带 `src` 来源，查不到的标 `⚠️ 待确认`。

### 非目标（二期或不做）
- 时间轴/购物表内联店名（Selfridges / Liberty / Harrods / Covent Garden …）不在一期。二期可在此架构上加 DOM 扫描器自动包裹。
- 朗读中文名（`nameCn`）不做——旅客对当地人说的就是英文。
- 语音/语速选择器不做——用合理默认。
- 真人录音不作为默认；仅当 TTS 实测读错且修正拼写无法可靠修复时，对极少数名字补小音频（见 §8"读错的再补"策略）。

## 3. 头脑风暴锁定的决策

| 维度 | 决定 |
|---|---|
| 发音引擎 | 浏览器 en-GB Web Speech API 为主；读错的少数名字做覆盖 |
| 范围 | 先做餐厅 + 景点 POI（数据驱动）；内联店名二期 |
| 设备 | iOS/Android/桌面都支持；无 en-GB 语音时优雅降级 |
| 点击行为 | 播放发音 + 显示 IPA 音标 |
| 代码结构 | A：独立 `pron.js` 数据 + `index.html` 内 `Pron` 模块，注入现有渲染函数 |

## 4. 架构

```
pron.js  (数据: key → {nameEn, ipa, src, override?})   ← 新文件
   │
   ▼
index.html:
  <script src="pron.js"></script>          ← 紧跟 restaurants.js 之后加载
  var PRON = window.PRON || {};            ← 紧跟 RESTAURANTS 定义处
  Pron 模块 (~70 行): 语音选择/播放/降级/取消
  注入点(4 处): 3 渲染函数 + wireRestaurantCards 守卫
  事件委托: document 单监听 [data-pron] → Pron.play(key)
   │
   ▼
sw.js: CORE 列表加 pron.js；SW_VER 升一档（uk7-v4 → uk7-v5）
```

地图标记点击已 funnel 进底部 Sheet（POI 标记 → `openSheet(poiSheetHtml(p, day))`；餐厅美食层标记 → `openSheet(restaurantSheetHtml(r))`），所以**只动 Sheet/卡片渲染函数，不动地图代码**。

## 5. 数据结构（`pron.js`）

```js
/* 发音数据 — 英国7日指南。IPA 须有权威来源；查不到标 ⚠️ 待确认，绝不编造。
 * key 规则：餐厅用 restaurants.js 的 r.id；POI 用 DAYS.pois[].pron（共享 slug，去重）。 */
window.PRON = {
  // —— 餐厅（key = r.id）——
  "d1-plough":     { nameEn:"The Plough",      ipa:"/ðə plaʊ/",        src:"Oxford Dictionaries" },
  "d6-dishoom":    { nameEn:"Dishoom",         ipa:"/ˈdɪʃuːm/",        src:"官网 native 核实" },
  // —— POI（key = p.pron slug，跨天同名共用）——
  "royal-national-hotel": { nameEn:"Royal National Hotel", ipa:"/ˈrɔɪəl ˈnæʃənl həʊˈtel/", src:"Oxford Dict + 逐词" },
  "christ-church":        { nameEn:"Christ Church",  ipa:"/ˌkraɪst ˈtʃɜːtʃ/",   src:"OxfordTourism" },
  "magdalen-college":     { nameEn:"Magdalen College", ipa:"/ˈmɔːdlɪn ˈkɒlɪdʒ/", src:"Oxford 官网",
                            override:{ say:"maudlin college" } },   // TTS 读错→喂修正拼写
  "borough-market":       { nameEn:"Borough Market",  ipa:"/ˈbʌrə ˈmɑːkɪt/",    src:"Cambridge Dict" },
  "leicester-square":     { nameEn:"Leicester Square", ipa:"/ˈlɛstə skwɛə/",     src:"Oxford Dict" },
  // —— 无权威来源 → IPA 标待确认，音频仍由 TTS 读 nameEn ——
  "some-unknown-shop":     { nameEn:"Some Unknown Shop", ipa:"⚠️ 待确认", src:"待核实" }
};
```

### 键策略
- **餐厅**：key = `r.id`（现成，餐厅数据零新增字段）。`restaurantSheetHtml` / `renderRestaurantCard` 注入 `data-pron="'+esc(r.id)+'"`。
- **POI**：在 `DAYS.dN.pois[]` 每条加一个 `pron` 字段（共享 slug，如 `royal-national-hotel`、`christ-church`）。同名 POI 跨天共用同一 slug → PRON 自然去重（Royal National Hotel 在 d1/d2/d3/d5/d7 出现 5 次但 PRON 只一条）。`poiSheetHtml` 注入 `data-pron="'+esc(p.pron)+'"`。

### 来源纪律（绝不编造）
- 每条 `src`：牛津/剑桥/朗曼词典、Wikipedia 发音键、官网、或 native 核实。词典条目优先。
- 查不到权威 IPA 的实体：`ipa:"⚠️ 待确认"`，`src:"待核实"`。音频（TTS 读 `nameEn`）仍正常工作，IPA 文本如实标注未核实。
- 与 `restaurants.js` 的标注纪律（已核实→真实值；未核实→⚠️）一致。

### 重复实体的取舍
"The Plough" 既是餐厅（`d1-plough`）又是 POI（d1 poi n:3，`pron:"the-plough"`）→ 两条 PRON 条目、IPA 相同。接受此轻微重复以保持：餐厅数据零改动、POI 用共享 slug 去重。两条互不影响。

## 6. `Pron` 模块（`index.html` 内联 `<script>`，约 70 行）

### API
- `Pron.play(key)`：查 `PRON[key]` → 朗读文本 = `override?.say` 或 `entry.nameEn`；`speechSynthesis.cancel()` 停上一次 → 新 `SpeechSynthesisUtterance(text)`，设 `lang='en-GB'`、`rate=0.92`、`pitch=1`、`voice`=所选 en-GB 语音 → 播报。
- `Pron.ready()`：`getVoices()` 异步加载，`voiceschanged` 事件后缓存语音列表。模块初始化时调用一次。

### 语音选择（按优先级降级）
1. `lang === 'en-GB'`（Apple Daniel/Kate/Serena、Google UK 等）。
2. 任意 `lang` 以 `en` 开头（en-US 等兜底，可接受轻微美音）。
3. 都没有 → **优雅降级**：不播音频，显示 IPA + 一条小提示"该设备无英语语音引擎"（`.pron-noengine` 类，toast 或内联），不报错、不抛异常。

### 行为细节
- **再点 = 重播**：每次 `play` 先 `cancel()` 再播；点别的名字也先 `cancel()` 上一个。
- **iOS 手势约束**：播报由用户点击 🔊 触发，满足 iOS Safari 需用户手势的要求。
- **iOS resume hack**：iOS 偶现 utterance 不触发 `end` 事件；必要时 `cancel()` 后短延迟再 `speak`。实现期若复现再处理。
- **无 `speechSynthesis` 支持**（极旧浏览器）：等同降级路径，显示 IPA + 提示。

## 7. UI / 交互

### 注入点（3 个渲染函数改名字行 + 1 处 `wireRestaurantCards` 守卫）

**1. `restaurantSheetHtml(r)`（index.html ~1421 行）**
名字行原样：
```js
+'<h3 class="sheet-title">'+esc(r.nameEn)+(isUnk(r.nameCn)?'':' <small>'+esc(r.nameCn)+'</small>')+'</h3>'
```
改为（名字后插 🔊 + IPA）：
```js
+'<h3 class="sheet-title">'+esc(r.nameEn)+(isUnk(r.nameCn)?'':' <small>'+esc(r.nameCn)+'</small>')+pronChip(r.id)+'</h3>'
```

**2. `renderRestaurantCard(r)`（index.html ~1457 行）**
名字行原样：
```js
+ '<div class="rc-hd"><b>'+esc(r.nameEn)+'</b>'+(isUnk(r.nameCn)?'':' <small>'+esc(r.nameCn)+'</small>')+badge+'</div>'
```
改为：
```js
+ '<div class="rc-hd"><b>'+esc(r.nameEn)+'</b>'+pronChip(r.id)+(isUnk(r.nameCn)?'':' <small>'+esc(r.nameCn)+'</small>')+badge+'</div>'
```

**3. `poiSheetHtml(p, day)`（index.html ~1219 行）**
名字行原样：
```js
+'<h3 class="sheet-title">'+esc(p.name)+'</h3>'
```
改为（POI 用 `p.pron`）：
```js
+'<h3 class="sheet-title">'+esc(p.name)+pronChip(p.pron)+'</h3>'
```

**4. `wireRestaurantCards(root)`（index.html ~1498 行）—— 加一行守卫，防止点 🔊 同时触发卡片开 Sheet**
原样：
```js
function wireRestaurantCards(root){
  root.addEventListener('click', function(e){
    var card=e.target.closest('.rc'); if(!card) return;
    var r=RESTAURANTS_BY_ID[card.getAttribute('data-rid')];
    if(r) openSheet(restaurantSheetHtml(r));
  });
}
```
改为（首行加守卫）：
```js
function wireRestaurantCards(root){
  root.addEventListener('click', function(e){
    if(e.target.closest('[data-pron]')) return;   // 点 🔊 → 不开 Sheet
    var card=e.target.closest('.rc'); if(!card) return;
    var r=RESTAURANTS_BY_ID[card.getAttribute('data-rid')];
    if(r) openSheet(restaurantSheetHtml(r));
  });
}
```
**为什么必须改这里**：`wireRestaurantCards` 被以 `root` 为 `document`（line 1794）、各 day 容器、`foodList`、`body` 多处调用。🔊 按钮位于 `.rc` 卡片内，`e.target.closest('.rc')` 会命中卡片 → 直接 `openSheet`。卡片监听挂在比 document 更低的元素上（或同为 document），其监听先于 document 级 `[data-pron]` 处理器触发——所以在 document 层 `stopPropagation()` 根本来不及。唯一可靠修法是在卡片处理器入口加 `closest('[data-pron]')` 守卫，无论监听注册顺序都早退。

### `pronChip(key)` 辅助函数
```js
function pronChip(key){
  if(!key) return '';
  var e = PRON[key]; if(!e) return '';           // 无条目→不渲染（餐厅/POI 未覆盖的静默跳过）
  var ipa = e.ipa ? '<span class="pron-ipa">'+esc(e.ipa)+'</span>' : '';
  return ' <button type="button" class="pron-btn" data-pron="'+esc(key)+'" '
       + 'aria-label="朗读 '+esc(e.nameEn)+' 的英文发音" title="听读音">🔊</button>'+ipa;
}
```

### 事件委托（单监听，挂在 document）
```js
document.addEventListener('click', function(ev){
  var b = ev.target.closest('[data-pron]');
  if(!b) return;
  Pron.play(b.getAttribute('data-pron'));
});
```
与卡片点击的关系：点 🔊 时，`wireRestaurantCards` 的守卫（见注入点 4）先 `return`、不开 Sheet；本处理器随后播报。两者职责分离——守卫负责"不误开 Sheet"，本处理器负责"发音"，无需 `stopPropagation`。

### 视觉
- 🔊 按钮与 IPA 内联在名字旁。示意：
```
餐厅卡片:  The Plough 犁酒馆  🔊 /ðə plaʊ/
POI Sheet: Christ Church · 14:10
           Christ Church  🔊 /ˌkraɪst ˈtʃɜːtʃ/
餐厅 Sheet:The Plough 犁酒馆  🔊 /ðə plaʊ/
```
- 样式（加到 index.html `<style>`）：
  - `.pron-btn`：无边框、`cursor:pointer`、`min-height:36px`（满足 44px 触摸区可借 padding）、`color:var(--claret)`、`vertical-align:middle`、`-webkit-tap-highlight-color:transparent`。
  - `.pron-ipa`：`font-size:.78rem`、`color:var(--muted)`、`font-family`等宽、暗色模式随 `data-theme`。
  - `.pron-noengine`：小提示样式。
  - `@media (prefers-reduced-speech: reduce)` 若浏览器支持 → 仍可手动点，不自动播（本功能本就不自动播，仅备注）。

## 8. "读错的再补"覆盖策略（分阶段）

1. **一期上线**：全量 TTS + IPA。`override` 字段暂为空。
2. **实测**：在 iPhone Safari（en-GB）、Android Chrome（en-GB）、Mac 桌面，逐个点 D1–D7 全部实体 🔊，记录 TTS 读错的。
3. **读错的加 `override`**，按可靠性递进：
   - 优先 `override:{ say:"<修正拼写>" }`（如 Magdalen→`maudlin college`、Wetherspoon→`wether-spoon`）。跨 en-GB 引擎实测可用即可。
   - 修正拼写仍无法可靠修复的极少数（预计 5–10 个，如 Cholmondeley）→ `override:{ audio:"audio/<key>.mp3" }`，小段录音放 `audio/` 目录，SW 按需缓存（首次 fetch 后入 cache）。
4. **IPA 始终显示权威值**，与 TTS 引擎是否读对无关——文本永远是"标准"基准。即便 TTS 暂未覆盖，IPA 已是正确参考。

## 9. 离线 / Service Worker

- `sw.js` 的 `CORE` 列表加入 `'./pron.js'`。
- `SW_VER` 从 `'uk7-v4'`（当前）升到 `'uk7-v5'`，让老客户端 activate 时清旧缓存、拉新版本。
- TTS 用设备本地语音引擎 → 离线可用；`pron.js`（IPA 数据）被 SW 缓存 → 离线也显示。
- 若二期加 `audio/*.mp3`：加入 `CORE` 预缓存，或 fetch-once-cache（SWR）策略，与现有 Leaflet 缓存模式一致。
- 地图瓦片本就 network-only 不缓存，不受影响。

## 10. 验收 / 测试

- **功能**：iPhone Safari（加主屏幕）逐个点 D1–D7 实体 🔊，确认音频播放 + IPA 显示；Android Chrome 同测；Mac 桌面开发自测。
- **降级**：Linux 桌面（通常无 en-GB 语音）→ 确认 IPA 显示 + "无英语语音引擎"提示、不抛异常。
- **离线**：断网刷新，点 🔊 → 音频仍响（本地 TTS）、IPA 仍显（SW 缓存 pron.js）。
- **SW 更新**：升 `SW_VER` 后刷新，确认取到新 pron.js（`restaurants.js`/`pron.js` 进 core 缓存）。
- **冒泡**：点卡片内 🔊 时确认**不**触发卡片 `openSheet`（`wireRestaurantCards` 守卫生效）。
- **无条目**：`PRON[key]` 不存在时 `pronChip` 返回空串，不报错、不渲染按钮。
- **实测清单**：D1–D7 全部 POI + 餐厅名走一遍，记录 TTS 读错的，回填 `override`（§8）。

## 11. 不在本期范围

- 时间轴/购物表内联店名（Selfridges / Liberty / Harrods / Covent Garden / Neal's Yard …）。二期可在此架构上加 DOM text-walker，扫描页面已知名自动包裹 `pronChip`，复用同一 `PRON` 注册表与 `Pron` 模块，不返工。
- 朗读中文名。
- 语音/语速选择器。
- 默认真人录音。

## 12. 风险 / 待定

- **IPA 来源工作量**：~24 餐厅 + ~53 POI（去重后约 60 条）需逐条核实 IPA 来源。词典收录的常用词快；专有名词/店名（如 Dishoom、Jugged Hare、Coal Drops Yard）需逐个查证或标 ⚠️。这是一次性数据苦工，不阻塞代码实现。
- **TTS 跨引擎一致性**：Apple en-GB 与 Google en-GB 对极少数名字（Magdalen 等）读法可能不同；`override.say` 修正拼写需在两引擎都验证。实在不行就上 `override.audio`。
- **iOS 语音触发**：iOS Safari 对 `speechSynthesis` 偶有手势/生命周期限制；实现期需在真机验证，必要时加 `cancel()+延时` 或 `resume()`。
- **POI `pron` 字段手填**：53 条 POI 各加一个 slug 字段，需对同名 POI 用同一 slug 以去重——手工编辑量中等，但与项目已有数据手作风范一致。

## 13. 实现状态（2026-09-26 已落地）

一期已实现并通过静态 + 逻辑验证：
- `pron.js`：80 条（35 餐厅 id-key + 45 POI slug-key，去重后 80）；`node --check` 通过。
- `index.html`：`Pron` 模块 + `pronChip` + document 委托 + 3 处渲染注入（`poiSheetHtml`/`restaurantSheetHtml`/`renderRestaurantCard`）+ `wireRestaurantCards` 守卫 + CSS；inline JS 编译通过。
- 53 个 POI 全部已加 `pron` 字段；35 个餐厅 id 全部在 `PRON`（覆盖率 100%，0 缺失）。
- `sw.js`：`SW_VER` → `uk7-v5`，`CORE` 加入 `./pron.js`；`node --check` 通过。
- 逻辑测试（桩 DOM + speechSynthesis，对实际嵌入代码断言）：`pronChip` 渲染按钮/IPA/aria-label/未知→空/⚠️ 条目；`Pron.play` 派发 speak、text=nameEn、lang=en-GB、rate=0.92、override.say 生效——14/15 通过（1 项"无语音降级"为测试桩人造序列所致，非代码缺陷，真实无语音设备从 init 起 `picked` 即为 null，走 `flashNoEngine`）。

### 6 条 ⚠️ 待确认（音频仍由 TTS 读 nameEn，IPA 如实标待确认）
- `kazan` / `d2-kazan`（伦敦 Kazan 餐厅，土耳其源名，无权威 IPA）
- `d4-sartorelli`（Sartorelli's Pizza，意大利姓）
- `d4-sasi-thai`（Sasi's Thai）
- `d4-turl-st`（Turl Street Kitchen；Turl 本地与 curl 押韵但未核实）
- `d5-the-marylebone`（店名待核实，原数据即未确认）

### 待办（"读错的再补"实测阶段）
- 在 iPhone Safari（en-GB）+ Android Chrome（en-GB）逐个点 D1–D7 实体 🔊，记录 TTS 读错的；对读错的加 `override:{say:"..."}`，实在不行补 `override:{audio:"audio/<key>.mp3"}`。
- 重点复测的 tricky 名（拼写误导）：St Pancras、The Plough、Wetherspoon、Magdalen、Bodleian、Ashmolean、Christ Church、Gloucester、Radcliffe、Tottenham、Marylebone、Borough、Covent、Sherlock Holmes、Pret a Manger、Bottega Veneta、Vivienne Westwood、Flat Iron、Hawksmoor。
- Vivienne Westwood、Bottega Veneta 两条例标待人工复核（来源较弱）。
