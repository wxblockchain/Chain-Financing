# WS-403 本地字体

- `Geist-review.woff2`：Geist variable，包含原型使用的 Latin / 数字范围。
- `NotoSansSC-review.woff2`：Noto Sans SC variable，按现有原型源码字符集裁剪的简体中文子集。
- 原字体来自 Google Fonts 的 `ofl/geist/Geist[wght].ttf` 与 `ofl/notosanssc/NotoSansSC[wght].ttf`；对应 SIL OFL 原文为同目录的 `Geist-OFL.txt`、`NotoSansSC-OFL.txt`，由导出器一并嵌入离线 HTML。

字体由 canonical `tokens.css` 注册。WS-403 用户确认后，两端全部原型默认使用该字体，数字采用 tabular；历史 `data-market-type="refined"` 评审属性继续兼容。2026-10-15 已检查当前原型 HTML / JS 的汉字字符集，子集均有覆盖。正式增加语言或大量动态文本前，应按目标字符集更新子集；缺字会回退到本机字体。本文件名中的 review 表示当前字库覆盖范围，不表示远程加载依赖。
