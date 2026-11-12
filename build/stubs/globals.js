import { Buffer } from "buffer";
var process = typeof globalThis.process !== "undefined" ? globalThis.process : {
  env: { NODE_ENV: "production" },
  browser: true,
  version: "",
  versions: {},
  argv: [],
  nextTick: function (fn) { var args = Array.prototype.slice.call(arguments, 1); Promise.resolve().then(function () { fn.apply(null, args); }); }
};
export { Buffer, process };
