// BotID client-side instrumentation.
//
// `initBotId({ protect })` tells the SDK which paths to inject the bot-
// detection fingerprinting JS into on the client. The corresponding
// server-side `checkBotId()` calls (in the submit action and the geocode
// route handler) validate the fingerprint. Basic mode (free on Hobby).
//
// Reference: https://vercel.com/docs/botid/get-started

import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    // Tip submit lives at /suggest — the form's server action posts back to
    // the same path. POST captures the server action invocation.
    { path: "/suggest", method: "POST" },
    // Correction submit lives at /[slug]/suggest — match every concrete slug
    // via the wildcard. (BotID's `path` is a literal string with `*` wildcards.)
    { path: "/*/suggest", method: "POST" },
    // The geocode proxy is hit from the address-autocomplete UI on both the
    // Tip and Correction forms (and from the admin RestaurantForm too).
    { path: "/api/geocode", method: "GET" },
  ],
});
