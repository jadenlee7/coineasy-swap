// Source for squid-mount.js (esbuild bundle of @0xsquid/widget 8.0.0,
// @0xsquid/react-hooks 10.0.0, and react 18.3.1).
//
// The widget mounts directly in index.html (no iframe). Squid's wallet code
// (WalletConnect modal and deep links) checks window.Telegram and whether it
// runs inside a frame; in a frame it could not see Telegram and tried to
// navigate the top window, which breaks wallet hand-off in Telegram.
//
// index.html sets window.__coineasyBoot before this script runs. This file
// never contains the integrator id.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { SquidWidget } from "@0xsquid/widget";
import { useTransactionStore } from "@0xsquid/react-hooks";

var BOOT_KEY = "coineasy-squid-boot";

function parseBoot(value) {
  try {
    var parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== "object" || !parsed.config) return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

function readBoot() {
  var boot = parseBoot(window.__coineasyBoot);
  if (boot) return boot;
  try {
    return parseBoot(sessionStorage.getItem(BOOT_KEY));
  } catch (err) {
    return null;
  }
}

function mount(root, config, amount) {
  if (amount) {
    useTransactionStore.setState({ fromPrice: String(amount) });
  }
  createRoot(root).render(createElement(SquidWidget, { config: config }));
}

var boot = readBoot();
var root = document.getElementById("squid-root");
if (root && boot) {
  mount(root, boot.config, boot.amount || "");
  document.documentElement.setAttribute("data-squid-mounted", "1");
} else if (root) {
  root.textContent = "스왑 화면을 불러오지 못했어요. 앱을 닫고 다시 열어 주세요.";
}
