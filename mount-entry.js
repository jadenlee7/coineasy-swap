// Source for squid-mount.js (esbuild bundle of @0xsquid/widget 8.0.0,
// @0xsquid/react-hooks 10.0.0, and react 18.3.1). The page passes config in
// sessionStorage; this file never contains the integrator id.
import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { SquidWidget } from "@0xsquid/widget";
import { useTransactionStore } from "@0xsquid/react-hooks";

var BOOT_KEY = "coineasy-squid-boot";

function readBoot() {
  try {
    var raw = sessionStorage.getItem(BOOT_KEY);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.config) return null;
    return parsed;
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
var root = document.getElementById("root");
if (root && boot) {
  mount(root, boot.config, boot.amount || "");
} else if (root) {
  root.textContent = "Open this swap from CoinEasy.";
}
