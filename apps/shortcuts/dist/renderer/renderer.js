"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const settings_1 = require("./settings");
require("./styles.css");
let shortcuts = {};
const settingsModal = new settings_1.SettingsModal();
async function loadShortcuts() {
    shortcuts = await electron_1.ipcRenderer.invoke('get-shortcuts');
    updateShortcutsUI();
}
function updateShortcutsUI() {
    const shortcutsContainer = document.getElementById('shortcuts');
    if (!shortcutsContainer)
        return;
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
    electron_1.ipcRenderer.send('toggle-window');
});
document.getElementById('settingsBtn')?.addEventListener('click', () => {
    settingsModal.show();
});
// Initialize
loadShortcuts();
//# sourceMappingURL=renderer.js.map