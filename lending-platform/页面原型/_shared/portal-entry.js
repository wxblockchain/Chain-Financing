/* One ordered dependency list for every customer entry and the offline exporter. */
(function () {
  const resources = {
    "styles": ["tokens.css", "base.css", "../面客端/借贷广场/借贷广场.css", "../面客端/资产广场/资产广场.css", "../面客端/借贷广场/放款与放款确认.css", "../面客端/借贷广场/还款计划与确认.css", "../面客端/我的控制台/我的控制台.css", "../面客端/登录与账户体系/登录与账户体系.css"],
    "scripts": ["registry.portal.js", "shell.js", "portal-init.js", "../面客端/资产广场/演示数据.js", "../面客端/借贷广场/演示数据.js", "../面客端/资产广场/项目演示接入.js", "../面客端/资产广场/资产广场.js", "../面客端/借贷广场/授信报价.js", "../面客端/借贷广场/借贷广场.js", "../面客端/我的控制台/控制台演示接入.js", "../面客端/我的控制台/我的控制台.js", "../面客端/借贷广场/放款与放款确认.js", "../面客端/借贷广场/还款计划与确认.js", "../面客端/登录与账户体系/资金方账户.js", "../面客端/登录与账户体系/登录与账户体系.js", "../面客端/消息中心/演示数据.js", "../面客端/消息中心/消息中心.js", "portal-connect.js"]
  };
  const base = document.currentScript.src;
  document.write(resources.styles.map(file => '<link rel="stylesheet" href="' + new URL(file, base).href + '">').join('') +
    resources.scripts.map(file => '<script src="' + new URL(file, base).href + '"><\/script>').join(''));
})();
