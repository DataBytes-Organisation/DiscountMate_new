"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// source/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => slow_down_default,
  slowDown: () => slowDown
});
module.exports = __toCommonJS(index_exports);

// source/slow-down.ts
var import_express_rate_limit = require("express-rate-limit");
var filterUndefinedOptions = (passedOptions) => {
  const filteredOptions = {};
  for (const k of Object.keys(passedOptions)) {
    const key = k;
    if (passedOptions[key] !== void 0) {
      filteredOptions[key] = passedOptions[key];
    }
  }
  return filteredOptions;
};
var ExpressSlowDownWarning = class extends Error {
  constructor(code, message) {
    const url = `https://express-rate-limit.github.io/${code}/`;
    super(`${message} See ${url} for more information.`);
    this.name = this.constructor.name;
    this.code = code;
    this.help = url;
  }
};
var slowDown = (passedOptions = {}) => {
  const notUndefinedOptions = filterUndefinedOptions(passedOptions);
  if (notUndefinedOptions.max !== void 0 || notUndefinedOptions.limit !== void 0)
    throw new Error(
      "The limit/max option is not supported by express-slow-down, please use delayAfter instead."
    );
  const validate = typeof notUndefinedOptions.validate === "boolean" ? { default: notUndefinedOptions.validate } : notUndefinedOptions.validate ?? { default: true };
  if (typeof notUndefinedOptions.delayMs === "number" && // Make sure the validation check is not disabled.
  (validate.delayMs === true || validate.delayMs === void 0 && validate.default)) {
    const message = `The behaviour of the 'delayMs' option was changed in express-slow-down v2:
			- For the old behavior, change the delayMs option to:

			  delayMs: (used, req) => {
				  const delayAfter = req.${notUndefinedOptions.requestPropertyName ?? "slowDown"}.limit;
				  return (used - delayAfter) * ${notUndefinedOptions.delayMs};
			  },

			- For the new behavior, change the delayMs option to:

				delayMs: () => ${notUndefinedOptions.delayMs},

			Or set 'options.validate: {delayMs: false}' to disable this message.`.replace(
      /^(\t){3}/gm,
      ""
    );
    console.warn(new ExpressSlowDownWarning("WRN_ESD_DELAYMS", message));
  }
  delete validate?.delayMs;
  const options = {
    // The following settings are defaults that may be overridden by the user's options.
    delayAfter: 1,
    delayMs(used, request, response) {
      const delayAfter2 = request[options.requestPropertyName].limit;
      return (used - delayAfter2) * 1e3;
    },
    maxDelayMs: Number.POSITIVE_INFINITY,
    requestPropertyName: "slowDown",
    // Disable the headers by default, but allow users to override
    legacyHeaders: false,
    standardHeaders: false,
    // Next the user's options are pulled in, overriding defaults from above
    ...notUndefinedOptions,
    // This is a combination of the user's validate settings and our own overrides
    validate: {
      ...validate,
      limit: false
      // We know the behavior of limit=0 changed - we depend on the new behavior!
    },
    // These settings cannot be overridden.
    limit: 0,
    // We want the handler to run on every request.
    // The handler contains the slow-down logic, so don't allow it to be overridden.
    async handler(_request, response, next) {
      const delayAfter2 = typeof options.delayAfter === "function" ? await options.delayAfter(_request, response) : options.delayAfter;
      const request = _request;
      const info = request[options.requestPropertyName];
      info.limit = delayAfter2;
      info.remaining = Math.max(0, delayAfter2 - info.used);
      let delay = 0;
      if (info.used > delayAfter2) {
        const unboundedDelay = typeof options.delayMs === "function" ? await options.delayMs(info.used, request, response) : options.delayMs;
        const maxDelayMs2 = typeof options.maxDelayMs === "function" ? await options.maxDelayMs(request, response) : options.maxDelayMs;
        delay = Math.max(0, Math.min(unboundedDelay, maxDelayMs2));
      }
      request[options.requestPropertyName].delay = delay;
      if (delay <= 0) return next();
      const timerId = setTimeout(() => next(), delay);
      response.on("close", () => clearTimeout(timerId));
    }
  };
  const { delayAfter, delayMs, maxDelayMs, ...erlOptions } = options;
  return (0, import_express_rate_limit.rateLimit)(erlOptions);
};
var slow_down_default = slowDown;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  slowDown
});
module.exports = slowDown; module.exports.default = slowDown; module.exports.slowDown = slowDown; 
