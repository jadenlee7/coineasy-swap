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

  var originalOpen = window.open;
  window.open = function (url, target, features) {
    if (!inTelegram() || url == null || url === "") {
      return originalOpen ? originalOpen.call(window, url, target, features) : null;
    }
    var href = String(url);
    if (/^(okx|metamask|trust|wc):/i.test(href)) {
      navigateNative(href);
      return null;
    }
    if (/^https?:\/\//i.test(href)) {
      openHttps(href);
      return null;
    }
    return originalOpen ? originalOpen.call(window, url, target, features) : null;
  };

  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest ? event.target.closest("[data-open],[data-external]") : null;
    if (!target) return;
    var kind = target.getAttribute("data-open");
    if (kind === "metamask" || kind === "trust" || kind === "okx" || kind === "browser") {
      event.preventDefault();
      openWallet(kind);
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
      new MutationObserver(function () { scanWalletList(); }).observe(
        document.documentElement || document.body,
        { childList: true, subtree: true }
      );
    } catch (e) {}
  }
  scanWalletList();

  if (window.ethereum && !inTelegram()) {
    var help = document.getElementById("wallet-help");
    if (help) help.hidden = true;
  }
})();
