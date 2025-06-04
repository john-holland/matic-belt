"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsModal = void 0;
const electron_1 = require("electron");
class SettingsModal {
    constructor() {
        this.shortcuts = {};
        this.modal = document.createElement('div');
        this.modal.className = 'settings-modal';
        this.modal.style.display = 'none';
        this.initializeModal();
    }
    initializeModal() {
        this.modal.innerHTML = `
      <div class="modal-content">
        <h2>Settings</h2>
        <div class="shortcuts-config"></div>
        <div class="window-settings">
          <label>
            <input type="checkbox" id="alwaysOnTop"> Always on top
          </label>
          <label>
            Transparency: <input type="range" id="transparency" min="0" max="100" value="80">
          </label>
        </div>
        <button id="saveSettings">Save</button>
        <button id="closeSettings">Close</button>
      </div>
    `;
        document.body.appendChild(this.modal);
        this.setupEventListeners();
    }
    setupEventListeners() {
        const shortcutsConfig = this.modal.querySelector('.shortcuts-config');
        if (!shortcutsConfig)
            return;
        for (let i = 1; i <= 10; i++) {
            const shortcutDiv = document.createElement('div');
            shortcutDiv.className = 'shortcut-config';
            shortcutDiv.innerHTML = `
        <h3>Shortcut ${i} (⌘⇧${i})</h3>
        <input type="text" id="shortcut${i}Command" placeholder="Command">
        <input type="text" id="shortcut${i}Description" placeholder="Description">
      `;
            shortcutsConfig.appendChild(shortcutDiv);
        }
        this.modal.querySelector('#saveSettings')?.addEventListener('click', () => this.saveSettings());
        this.modal.querySelector('#closeSettings')?.addEventListener('click', () => this.hide());
    }
    async show() {
        this.shortcuts = await electron_1.ipcRenderer.invoke('get-shortcuts');
        await this.updateForm();
        this.modal.style.display = 'flex';
    }
    hide() {
        this.modal.style.display = 'none';
    }
    async updateForm() {
        for (let i = 1; i <= 10; i++) {
            const shortcut = this.shortcuts[`shortcut${i}`];
            const commandInput = document.getElementById(`shortcut${i}Command`);
            const descriptionInput = document.getElementById(`shortcut${i}Description`);
            if (commandInput && descriptionInput) {
                commandInput.value = shortcut?.command || '';
                descriptionInput.value = shortcut?.description || '';
            }
        }
        const alwaysOnTopCheckbox = document.getElementById('alwaysOnTop');
        const transparencySlider = document.getElementById('transparency');
        if (alwaysOnTopCheckbox) {
            alwaysOnTopCheckbox.checked = await electron_1.ipcRenderer.invoke('get-setting', 'alwaysOnTop');
        }
        if (transparencySlider) {
            const transparency = await electron_1.ipcRenderer.invoke('get-setting', 'transparency');
            transparencySlider.value = String((transparency || 0.8) * 100);
        }
    }
    async saveSettings() {
        const newShortcuts = {};
        for (let i = 1; i <= 10; i++) {
            const commandInput = document.getElementById(`shortcut${i}Command`);
            const descriptionInput = document.getElementById(`shortcut${i}Description`);
            if (commandInput && descriptionInput) {
                newShortcuts[`shortcut${i}`] = {
                    command: commandInput.value,
                    description: descriptionInput.value
                };
            }
        }
        const alwaysOnTopCheckbox = document.getElementById('alwaysOnTop');
        const transparencySlider = document.getElementById('transparency');
        await electron_1.ipcRenderer.invoke('update-settings', {
            shortcuts: newShortcuts,
            alwaysOnTop: alwaysOnTopCheckbox?.checked ?? true,
            transparency: transparencySlider ? parseInt(transparencySlider.value) / 100 : 0.8
        });
        this.hide();
    }
}
exports.SettingsModal = SettingsModal;
//# sourceMappingURL=settings.js.map