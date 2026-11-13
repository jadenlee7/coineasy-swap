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
    try { if (tg.setBottomBarColor) tg.setBottomBarColor("#000000"); } catch (e) {}
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

  // Quote status in Korean. The widget button text is the source of truth.
  if (typeof document.querySelector !== "function" || typeof MutationObserver !== "function") return;

  var status = document.getElementById("swap-status");
  var root = document.getElementById("squid-root");
  if (!status || !root || typeof root.querySelectorAll !== "function") return;

  var COPY = {
    loading: "견적을 가져오는 중…",
    confirm: "스왑 확인",
    success: "스왑이 완료됐어요 ✨",
    error: "견적을 못 가져왔어요. 조금만 있다 다시 해볼까요?"
  };

  function primaryButton() {
    var buttons = root.querySelectorAll("button");
    var best = null;
    var bestW = 0;
    for (var i = 0; i < buttons.length; i++) {
      var w = buttons[i].getBoundingClientRect().width;
      if (w > bestW) {
        bestW = w;
        best = buttons[i];
      }
    }
    return bestW >= 140 ? best : null;
  }

  function classify(text, button) {
    var t = (text || "").replace(/\s+/g, " ").trim();
    if (/Getting quotes|Opening deposit|Checking approval|Approving|Preparing swap|Opening payment/i.test(t)) return "loading";
    if (/Swap unavailable|Swap failed|Transaction failed|Bridge failed|something went wrong/i.test(t)) return "error";
    if (/Swap complete|Tokens received|Bridge complete/i.test(t)) return "success";
    if ((t === "스왑하기" || t === "Swap") && button && !button.disabled) return "confirm";
    if (!t) return "loading";
    return "";
  }

  function paint(state) {
    if (!state || !COPY[state]) {
      status.hidden = true;
      status.removeAttribute("data-state");
      status.textContent = "";
      return;
    }
    status.hidden = false;
    status.setAttribute("data-state", state);
    status.textContent = COPY[state];
  }

  function sync() {
    var button = primaryButton();
    var text = button ? (button.innerText || button.textContent || "") : "";
    var body = root.innerText || "";
    if (/Swap complete|Tokens received|Bridge complete/i.test(body)) {
      paint("success");
      return;
    }
    if (!text && /Swap unavailable|Swap failed/i.test(body)) {
      paint("error");
      return;
    }
    paint(classify(text, button));
  }

  var queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      sync();
    });
  }

  new MutationObserver(schedule).observe(root, { childList: true, subtree: true, characterData: true });
  schedule();
})();
