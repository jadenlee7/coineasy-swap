(function () {
  // Telegram Mini App chrome: black header, no swipe-to-close while scrolling
  // the swap card, and external links opened the Telegram way.
  var webApp = window.Telegram && window.Telegram.WebApp;
  // telegram-web-app.js defines WebApp everywhere; platform is "unknown"
  // outside Telegram.
  var tg = webApp && webApp.platform && webApp.platform !== "unknown" ? webApp : null;
  if (tg) {
    try { if (tg.setHeaderColor) tg.setHeaderColor("#000000"); } catch (e) {}
    try { if (tg.setBackgroundColor) tg.setBackgroundColor("#000000"); } catch (e) {}
    try { if (tg.disableVerticalSwipes) tg.disableVerticalSwipes(); } catch (e) {}
  }

  function openExternal(url) {
    if (tg && tg.openLink) {
      try { tg.openLink(url); return; } catch (e) {}
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // The page URL with the same prefill, so a wallet browser opens the same swap.
  function swapUrl() {
    var loc = window.location;
    var search = loc.search || "";
    var boot = window.__coineasyBoot;
    if (!search && boot && boot.startParam) {
      search = "?tgWebAppStartParam=" + encodeURIComponent(boot.startParam);
    }
    return loc.origin + loc.pathname + search;
  }

  var builders = {
    metamask: function (u) { return "https://metamask.app.link/dapp/" + u.replace(/^https?:\/\//, ""); },
    trust: function (u) { return "https://link.trustwallet.com/open_url?coin_id=60&url=" + encodeURIComponent(u); },
    coinbase: function (u) { return "https://go.cb-w.com/dapp?cb_url=" + encodeURIComponent(u); },
    browser: function (u) { return u; }
  };

  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest ? event.target.closest("[data-open],[data-external]") : null;
    if (!target) return;
    var kind = target.getAttribute("data-open");
    if (kind && builders[kind]) {
      event.preventDefault();
      openExternal(builders[kind](swapUrl()));
      return;
    }
    if (target.hasAttribute("data-external") && target.href) {
      event.preventDefault();
      openExternal(target.href);
    }
  });

  // Inside a wallet's own browser the wallet is already injected; hide the
  // "open in wallet" tips there.
  if (window.ethereum && !tg) {
    var help = document.getElementById("wallet-help");
    if (help) help.hidden = true;
  }
})();
