import { Config } from '@remotion/cli/config';

// Point this at a local Chromium/headless-shell binary if the sandbox has
// no network access to fetch Remotion's own copy (e.g. REMOTION_BROWSER=
// /path/to/headless_shell). Left unset, Remotion downloads and manages one
// itself, which is the right default anywhere with normal internet access.
if (process.env.REMOTION_BROWSER) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER);
}

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer('angle');
