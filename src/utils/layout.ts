import { Platform } from 'react-native';

export const DESKTOP_MOBILE_LAYOUT_BREAKPOINT = 860;
export const DESKTOP_MOBILE_FRAME_WIDTH = 430;

export function shouldUseDesktopMobileLayout(windowWidth: number) {
  return Platform.OS === 'web' && windowWidth >= DESKTOP_MOBILE_LAYOUT_BREAKPOINT;
}

export function getDesktopMobileFrameWidth(windowWidth: number) {
  return Math.min(DESKTOP_MOBILE_FRAME_WIDTH, Math.max(320, windowWidth - 24));
}
