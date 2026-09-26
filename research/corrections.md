# 行程修正记录（2026-09-25 第二轮，基于用户补充 + 3 个并行 subagent 调研）

## 用户补充的正确事实（覆盖原规划）
- D1：航班 **19:40 当地时间落 LGW**（非深夜）→ 无末班问题。
- D2：**跟团**，08:00 Victoria 集合、19:00 回 Victoria（团负责白崖交通）。
- D3：**跟团**，10:45 King's Cross（Bus Stop T, Pancras Rd）集合、18:00 回、16:00 集合。
- D4：基督堂 **14:10 票**；换酒店 Royal National → **City Sleeper at Royal National Hotel**（同一栋楼同地址，升级房型），退房后同楼寄存再去牛津。
- D5：上午 10-11 入大英博物馆（11:10 锁定），下午贝克街福尔摩斯。
- D7：**22:10 LHR 航班**；行李需寄存，可能折返取行李再赴机场。

## subagent 调研关键结论
1. **地图 Blocked 根因**：用户在中国大陆，jsdelivr 2022-04 起 DNS 污染、tile.openstreetmap.org ERR_CONNECTION_RESET、unpkg 不稳。**修复**：BootCDN 加载链（bootcdn→staticfile→baomitu→unpkg→jsdelivr）+ Esri World_Imagery 卫星瓦片（大陆可达、覆盖英国、免 key）为主 + OSM 法国镜像 hot 为切换层；_lfRegister 延迟 initAllMaps 直到 Leaflet 就绪。
2. **City Sleeper = 同楼同地址**（38-51 Bedford Way），Royal National 的升级装修房型，4 星营销/8.5 分，24h 前台 + 免费行李寄存。
3. **Christ Church 10-1**：属 Summer Vacation（Michaelmas 10-4 才开始），Hall 工作日 12-14 学生午休关闭，**14:10 时段在关闭段之后，Hall 应已重开**。在线票 £22.95（省 £2）。known-closures 临行查。
4. **D5 地铁修正**：Tottenham Court Rd **不在 Bakerloo 线**（Central/Northern/Elizabeth）。去贝克街：TCR→Central 东 1 站 Oxford Circus→换 Bakerloo 北 2 站 Baker St。
5. **D3 团运营商**：Golden Tours/Premium Tours/kaytrip 整合均有 King's Cross Bus Stop T 上团；标准票 £58.50，含大巴套票 £94-129。Dark Arts 9-16~11-08。
6. **D6/D7**：伦敦眼线上 £29/当天 £39；塔桥展览 £16-17；英国 2021 取消 VAT 退税仍未恢复；周日大店限 6h（常 12-18）；Elizabeth 线 TCR→LHR T2/3 ~32min £10.60（周日 off-peak，带行李舒适），Piccadilly Russell Sq→LHR 全航站楼 ~60min £3.70；Sunday Roast The Lighterman（Granary Sq，须预订）。
7. **Victoria 晚餐**（D2）：The Jugged Hare（gastropub）、Kazan（土耳其）、Wetherspoon's The Victoria（平价 pub）。Victoria 周边无高口碑中餐。

## 已修正的 ⚠️ 风险点（原 findings.md 中部分已过时）
- 原"D2 19:00 回 vs 日落冲突"——作废（跟团，时间固定）。
- 原"D2 13X 巴士/Southern 工程自驾方案"——作废（团负责交通）。
- 原"D3 自行 Euston→Watford Junction"——改为跟团 King's Cross。
- 原"D5 TCR→Bakerloo"——修正为 Central→Oxford Circus 换 Bakerloo。
- 新增"D4 同楼换酒店寄存"、"D7 航站楼选线"。

## 已修复的 HTML 技术问题
- JS 数据中 `'Regent's Park'`（单引号含撇号）会导致整段脚本 SyntaxError → 改为双引号 `"Regent's Park"`。`King's Cross` 同样全部双引号。
- toggleExpandAll 原逻辑与 `.h-collapsed` CSS 冲突 → 改为纯 `open` 属性切换。

权威交付物：`research/uk-trip-guide.html`（已全部反映上述修正）。
