import { registerFileCheckpointExtension } from './src/file-checkpoint.js';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function piFileCheckpointExtension(pi: ExtensionAPI): void {
  registerFileCheckpointExtension(pi);
}
