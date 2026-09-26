import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the same Vite build that runs in a browser tab. No second codebase, no second
 * interview.
 *
 * `minSdkVersion` is not set here (it lives in android/variables.gradle after `cap add android`);
 * the target is API 24 / Android 7, which is what a ₹6,000 handset in a panchayat bhavan actually
 * runs. The whole point of this channel is that it works on the hardware that exists.
 */
const config: CapacitorConfig = {
  appId: 'in.gov.mosje.ajay.livelihood',
  appName: 'PM-AJAY Livelihood',
  webDir: 'dist',
  android: {
    // Long, offline-first sessions: never let the WebView be backgrounded mid-interview by a
    // hardware-accelerated surface swap.
    // false, and it stays false. VITE_ASR_URL now points at the Supabase edge function over
    // https, so nothing needs a mixed-content exception. The audio on that wire is a
    // beneficiary's voice; it does not travel in clear text.
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // The splash is short on purpose. A four-second brand animation in front of somebody who has
    // walked to a panchayat bhavan is a cost, not an experience.
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#3b1436',
      showSpinner: false,
    },
  },
};

export default config;
