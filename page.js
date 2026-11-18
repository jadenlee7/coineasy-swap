(function () {
  // Telegram Mini App chrome: black header, no swipe-to-close while scrolling
  // the swap card, and external links opened the Telegram way.
  var FALLBACK_MS = 1500;
  var HIDE_WALLET_NAMES = {
    metamask: true,
    "coinbase wallet": true,
    coinbase: true,
    "browser extension": true,
    "mobile wallet": true
  };
  var INTERCEPT_TO = {
    metamask: "metamask",
    "okx wallet": "okx",
    okx: "okx",
    "trust wallet": "trust",
    trust: "trust"
  };

  function webApp() {
    return window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  }
  function inTelegram() {
    var tg = webApp();
    return !!(tg && tg.platform && tg.platform !== "unknown");
  }
  function getTg() {
    return inTelegram() ? webApp() : null;
  }

  function inWalletBrowser() {
    return !!(window.ethereum && !inTelegram());
  }

  function isMobileUi() {
    var tg = getTg();
    if (tg) {
      var platform = String(tg.platform || "").toLowerCase();
      if (platform === "ios" || platform === "android") return true;
      if (
        platform === "tdesktop" ||
        platform === "macos" ||
        platform === "linux" ||
        platform === "web" ||
        platform === "weba"
      ) {
        return false;
      }
    }
    try {
      return !!(window.matchMedia && window.matchMedia("(max-width: 640px)").matches);
    } catch (e) {
      return false;
    }
  }

  function applyWalletLayout() {
    var inWallet = inWalletBrowser();
    var mobile = isMobileUi();
    var primary = document.getElementById("wallet-primary");
    var secondary = document.getElementById("wallet-wc-secondary");
    var help = document.getElementById("wallet-help");
    if (primary) primary.hidden = inWallet || !mobile;
    if (secondary) secondary.hidden = inWallet || !mobile;
    if (help) help.hidden = inWallet || mobile;
  }

  var tgAtBoot = getTg();
  if (tgAtBoot) {
    try { if (tgAtBoot.setHeaderColor) tgAtBoot.setHeaderColor("#000000"); } catch (e) {}
    try { if (tgAtBoot.setBackgroundColor) tgAtBoot.setBackgroundColor("#000000"); } catch (e) {}
    try { if (tgAtBoot.disableVerticalSwipes) tgAtBoot.disableVerticalSwipes(); } catch (e) {}
  }

  function swapUrl() {
    var loc = window.location;
    var search = loc.search || "";
    var boot = window.__coineasyBoot;
    if (!search && boot && boot.startParam) {
      search = "?tgWebAppStartParam=" + encodeURIComponent(boot.startParam);
    }
    return loc.origin + loc.pathname + search;
  }

  function pathOnly(u) {
    return u.replace(/^https?:\/\//, "");
  }

  function nativeLinks(u) {
    return {
      metamask: "metamask://dapp/" + pathOnly(u),
      trust: "trust://open_url?coin_id=60&url=" + encodeURIComponent(u),
      okx: "okx://wallet/dapp/url?dappUrl=" + encodeURIComponent(u)
    };
  }

  function httpsLinks(u) {
    return {
      metamask: "https://metamask.app.link/dapp/" + pathOnly(u),
      trust: "https://link.trustwallet.com/open_url?coin_id=60&url=" + encodeURIComponent(u),
      okx: "https://web3.okx.com/download?deeplink=" + encodeURIComponent("okx://wallet/dapp/url?dappUrl=" + encodeURIComponent(u)),
      browser: u
    };
  }

  function openHttps(url) {
    var tg = getTg();
    if (tg && tg.openLink) {
      try {
        tg.openLink(url, { try_instant_view: false });
        return;
      } catch (e) {
        try { tg.openLink(url); return; } catch (e2) {}
      }
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function navigateNative(url) {
    try {
      if (window.location && typeof window.location.assign === "function") {
        window.location.assign(url);
        return;
      }
    } catch (e) {}
    try { window.location.href = url; } catch (e2) {}
  }

  function openNativeThenHttps(nativeUrl, httpsUrl) {
    var handedOff = false;
    function mark() { handedOff = true; }
    try { window.addEventListener("pagehide", mark); } catch (e) {}
    try { window.addEventListener("blur", mark); } catch (e) {}
    try {
      document.addEventListener("visibilitychange", function () {
        if (document.hidden) mark();
      });
    } catch (e) {}
    navigateNative(nativeUrl);
    window.setTimeout(function () {
      if (handedOff) return;
      if (typeof document.hidden === "boolean" && document.hidden) return;
      openHttps(httpsUrl);
    }, FALLBACK_MS);
  }

  function openWallet(kind) {
    var u = swapUrl();
    var https = httpsLinks(u);
    if (kind === "browser") {
      openHttps(u);
      return;
    }
    var natives = nativeLinks(u);
    if (inTelegram() && natives[kind] && https[kind]) {
      openNativeThenHttps(natives[kind], https[kind]);
      return;
    }
    if (https[kind]) openHttps(https[kind]);
  }

  function openInWalletBrowser(kind) {
    var https = httpsLinks(swapUrl());
    var url = https[kind];
    if (!url) return;
    var tg = getTg();
    if (tg && tg.openLink) {
      try {
        tg.openLink(url, { try_instant_view: false });
        return;
      } catch (e) {
        try { tg.openLink(url); return; } catch (e2) {}
      }
    }
    try { window.location.assign(url); } catch (e3) {
      window.location.href = url;
    }
  }

  function extractWcUri(url) {
    if (url == null || url === "") return "";
    var s = String(url);
    if (/^wc:/i.test(s)) return s;
    var found = "";
    try {
      var parsed = new URL(s, "https://dummy.invalid");
      var keys = ["uri", "wc", "deeplink"];
      for (var i = 0; i < keys.length; i++) {
        var raw = parsed.searchParams.get(keys[i]) || "";
        if (!raw) continue;
        var inner = extractWcUri(raw);
        if (inner) { found = inner; break; }
        try {
          var decoded = decodeURIComponent(raw);
          inner = extractWcUri(decoded);
          if (inner) { found = inner; break; }
        } catch (e) {}
      }
    } catch (e2) {}
    if (found) return found;
    var match = s.match(/wc:[^\s"'<>]+/i);
    if (!match) return "";
    try { return decodeURIComponent(match[0]); } catch (e3) { return match[0]; }
  }

  function wcUniversalLinks(wcUri) {
    var enc = encodeURIComponent(wcUri);
    return {
      metamask: "https://metamask.app.link/wc?uri=" + enc,
      trust: "https://link.trustwallet.com/wc?uri=" + enc,
      okx: "https://www.okx.com/download?deeplink=" + encodeURIComponent("okx://main/wc?uri=" + enc)
    };
  }

  var wcPanel = null;
  var wcCurrentUri = "";

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        var done = navigator.clipboard.writeText(text);
        if (done && typeof done.then === "function") return done.catch(function () { copyTextFallback(text); });
        return;
      } catch (e) {}
    }
    copyTextFallback(text);
  }

  function copyTextFallback(text) {
    var input = document.getElementById("coineasy-wc-uri");
    if (!input) return;
    try {
      input.removeAttribute("disabled");
      input.removeAttribute("readonly");
      input.value = text;
      input.focus();
      input.select();
      if (document.execCommand) document.execCommand("copy");
    } catch (e) {}
    try { input.setAttribute("readonly", ""); } catch (e2) {}
  }

  function renderWcQr(box, text) {
    if (!box) return;
    box.innerHTML = "";
    var make = window.qrcode;
    if (typeof make !== "function") {
      box.textContent = "QR을 만들지 못했어요. 아래 버튼이나 URI 복사를 사용해 주세요.";
      return;
    }
    try {
      var qr = make(0, "M");
      qr.addData(text);
      qr.make();
      box.innerHTML = typeof qr.createSvgTag === "function" ? qr.createSvgTag({ scalable: true, margin: 2 }) : "";
      var svg = box.firstChild;
      if (svg && svg.style) {
        svg.style.width = "100%";
        svg.style.height = "auto";
        svg.style.background = "#fff";
        svg.style.borderRadius = "12px";
        svg.style.display = "block";
      }
    } catch (e) {
      box.textContent = "QR을 만들지 못했어요. 아래 버튼이나 URI 복사를 사용해 주세요.";
    }
  }

  function ensureWcPanel() {
    if (wcPanel && wcPanel.isConnected !== false) return wcPanel;
    var existing = document.getElementById("coineasy-wc");
    if (existing) { wcPanel = existing; return wcPanel; }
    var section = document.createElement("section");
    section.id = "coineasy-wc";
    section.className = "card card-wc";
    section.hidden = true;
    section.innerHTML = ""
      + "<h2>WalletConnect</h2>"
      + "<p>같은 전화에서는 아래 지갑 버튼으로 연결하세요. QR은 다른 기기의 지갑으로 스캔할 수 있어요. 지갑에서 승인한 뒤 이 화면으로 돌아와 주세요.</p>"
      + '<div class="wc-qr" id="coineasy-wc-qr" aria-hidden="false"></div>'
      + '<input id="coineasy-wc-uri" class="wc-uri" readonly value="">'
      + '<div class="wallet-links">'
      + '<button type="button" class="pill pill-white" data-wc="metamask">MetaMask로 연결</button>'
      + '<button type="button" class="pill pill-white" data-wc="okx">OKX로 연결</button>'
      + '<button type="button" class="pill pill-white" data-wc="trust">Trust로 연결</button>'
      + '<button type="button" class="pill pill-ghost" data-wc-copy>URI 복사</button>'
      + '<button type="button" class="pill pill-ghost" data-wc-close>닫기</button>'
      + "</div>";
    var anchor = document.getElementById("wallet-wc-secondary") || document.getElementById("wallet-help");
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(section, anchor);
    else if (document.body) document.body.appendChild(section);
    wcPanel = section;
    return wcPanel;
  }

  function showWcPanel(uri) {
    if (!inTelegram() || !uri) return;
    var wcUri = extractWcUri(uri) || (/^wc:/i.test(uri) ? uri : "");
    if (!wcUri) return;
    wcCurrentUri = wcUri;
    var panel = ensureWcPanel();
    if (!panel) return;
    panel.hidden = false;
    var input = document.getElementById("coineasy-wc-uri");
    if (input) input.value = wcUri;
    renderWcQr(document.getElementById("coineasy-wc-qr"), wcUri);
    try { panel.scrollIntoView({ block: "center" }); } catch (e) {}
  }

  function hideWcPanel() {
    if (wcPanel) wcPanel.hidden = true;
  }

  var originalOpen = window.open;
  window.open = function (url, target, features) {
    if (!inTelegram() || url == null || url === "") {
      return originalOpen ? originalOpen.call(window, url, target, features) : null;
    }
    var href = String(url);
    var wcUri = extractWcUri(href);
    if (wcUri) {
      showWcPanel(wcUri);
      return null;
    }
    if (/^https?:\/\//i.test(href)) {
      openHttps(href);
      return null;
    }
    return originalOpen ? originalOpen.call(window, url, target, features) : null;
  };

  document.addEventListener("click", function (event) {
    var wcTarget = event.target && event.target.closest ? event.target.closest("[data-wc],[data-wc-copy],[data-wc-close]") : null;
    if (wcTarget && wcCurrentUri) {
      if (wcTarget.hasAttribute("data-wc-close")) {
        event.preventDefault();
        hideWcPanel();
        return;
      }
      if (wcTarget.hasAttribute("data-wc-copy")) {
        event.preventDefault();
        copyText(wcCurrentUri);
        return;
      }
      var wcKind = wcTarget.getAttribute("data-wc");
      var links = wcUniversalLinks(wcCurrentUri);
      if (wcKind && links[wcKind]) {
        event.preventDefault();
        openHttps(links[wcKind]);
        return;
      }
    }
    var target = event.target && event.target.closest ? event.target.closest("[data-open],[data-external]") : null;
    if (!target) return;
    var kind = target.getAttribute("data-open");
    if (kind === "metamask" || kind === "trust" || kind === "okx" || kind === "browser") {
      event.preventDefault();
      if (target.getAttribute("data-wallet-browser") === "1" && kind !== "browser") {
        openInWalletBrowser(kind);
      } else {
        openWallet(kind);
      }
      return;
    }
    if (target.hasAttribute("data-external") && target.href) {
      event.preventDefault();
      openHttps(target.href);
    }
  });

  function walletName(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
      .replace(/\s+(installed|disconnect|connected)\b.*/, "")
      .trim();
  }

  function walletLists() {
    var found = [];
    if (!document.querySelectorAll) return found;
    var inputs = document.querySelectorAll('input[placeholder="Select your wallet"]');
    for (var i = 0; i < inputs.length; i++) {
      var el = inputs[i];
      for (var depth = 0; depth < 8 && el; depth++) {
        var ul = el.querySelector ? el.querySelector("ul") : null;
        if (ul) {
          found.push(ul);
          break;
        }
        el = el.parentElement;
      }
    }
    return found;
  }

  function harvestWcUri(root) {
    if (!inTelegram()) return;
    var scope = root && root.querySelectorAll ? root : document;
    var nodes = [];
    try { nodes = scope.querySelectorAll ? scope.querySelectorAll("wcm-qrcode, w3m-qrcode") : []; } catch (e) {}
    for (var i = 0; i < nodes.length; i++) {
      var uri = nodes[i].uri || (nodes[i].getAttribute && (nodes[i].getAttribute("uri") || nodes[i].getAttribute("data-uri"))) || "";
      if (uri) showWcPanel(uri);
    }
  }

  function kickRelayer() {
    try { window.dispatchEvent(new Event("focus")); } catch (e) {}
  }

  try {
    window.addEventListener("pageshow", kickRelayer);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) kickRelayer();
    });
  } catch (e) {}

  if (navigator.clipboard && navigator.clipboard.writeText) {
    var originalWrite = navigator.clipboard.writeText.bind(navigator.clipboard);
    navigator.clipboard.writeText = function (text) {
      if (inTelegram() && extractWcUri(text)) showWcPanel(text);
      return originalWrite(text);
    };
  }

  function scanWalletList() {
    if (!inTelegram()) return;
    var lists = walletLists();
    for (var i = 0; i < lists.length; i++) {
      var children = lists[i].children || [];
      for (var j = 0; j < children.length; j++) {
        var row = children[j];
        var title = row.querySelector ? row.querySelector(".tw-text-grey-300") : null;
        var name = walletName((title && title.textContent) || row.textContent);
        if (HIDE_WALLET_NAMES[name]) {
          if (row.style) row.style.display = "none";
          try { if (row.setAttribute) row.setAttribute("data-coineasy-hidden", "1"); } catch (e) {}
        }
      }
    }
  }

  document.addEventListener("click", function (event) {
    if (!inTelegram() || !event.target) return;
    var lists = walletLists();
    if (!lists.length) return;
    var node = event.target;
    var list = null;
    for (var i = 0; i < lists.length; i++) {
      var ul = lists[i];
      if (ul.contains && ul.contains(node)) {
        list = ul;
        break;
      }
      var walk = node;
      for (var d = 0; d < 12 && walk; d++) {
        if (walk === ul) { list = ul; break; }
        walk = walk.parentElement;
      }
      if (list) break;
    }
    if (!list || !list.children) return;
    var row = node;
    var hit = null;
    for (var up = 0; up < 12 && row; up++) {
      for (var c = 0; c < list.children.length; c++) {
        if (list.children[c] === row) { hit = row; break; }
      }
      if (hit) break;
      row = row.parentElement;
    }
    if (!hit) return;
    var title = hit.querySelector ? hit.querySelector(".tw-text-grey-300") : null;
    var name = walletName((title && title.textContent) || hit.textContent);
    var dest = INTERCEPT_TO[name];
    if (dest || HIDE_WALLET_NAMES[name]) {
      if (event.preventDefault) event.preventDefault();
      if (event.stopPropagation) event.stopPropagation();
      if (dest) openWallet(dest);
    }
  }, true);

  if (window.MutationObserver) {
    try {
      new MutationObserver(function () { scanWalletList(); harvestWcUri(document); }).observe(
        document.documentElement || document.body,
        { childList: true, subtree: true }
      );
    } catch (e) {}
  }
  scanWalletList();
  harvestWcUri(document);

  applyWalletLayout();
  try { window.addEventListener("resize", applyWalletLayout); } catch (e) {}
  try { window.addEventListener("orientationchange", applyWalletLayout); } catch (e) {}
})();
