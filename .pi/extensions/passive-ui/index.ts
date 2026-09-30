import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { registerPassiveUi } from './src/passive-ui.js';

export default function passiveUiExtension(pi: ExtensionAPI): void {
  registerPassiveUi(pi);
}
