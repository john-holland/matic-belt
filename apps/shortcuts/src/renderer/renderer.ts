import { ipcRenderer } from 'electron';
import { SettingsModal } from './settings';
import './styles.css';

interface Shortcut {
  command: string;
  description: string;
}

let shortcuts: { [key: string]: Shortcut } = {};
const settingsModal = new SettingsModal();

async function loadShortcuts() {
  shortcuts = await ipcRenderer.invoke('get-shortcuts');
  updateShortcutsUI();
}

function updateShortcutsUI() {
  const shortcutsContainer = document.getElementById('shortcuts');
  if (!shortcutsContainer) return;

  shortcutsContainer.innerHTML = '';
  
  for (let i = 1; i <= 10; i++) {
    const shortcut = shortcuts[`shortcut${i}`];
    const shortcutElement = document.createElement('div');
    shortcutElement.className = 'shortcut';
    shortcutElement.textContent = `⌘⇧${i}: ${shortcut?.description || 'Not set'}`;
    shortcutElement.title = shortcut?.command || '';
    shortcutsContainer.appendChild(shortcutElement);
  }
}

// Event Listeners
document.getElementById('closeBtn')?.addEventListener('click', () => {
  ipcRenderer.send('toggle-window');
});

document.getElementById('settingsBtn')?.addEventListener('click', () => {
  settingsModal.show();
});

// Initialize
loadShortcuts(); 