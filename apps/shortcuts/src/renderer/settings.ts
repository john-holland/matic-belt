import { ipcRenderer } from 'electron';

interface Shortcut {
  command: string;
  description: string;
}

export class SettingsModal {
  private modal: HTMLDivElement;
  private shortcuts: { [key: string]: Shortcut } = {};

  constructor() {
    this.modal = document.createElement('div');
    this.modal.className = 'settings-modal';
    this.modal.style.display = 'none';
    this.initializeModal();
  }

  private initializeModal() {
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

  private setupEventListeners() {
    const shortcutsConfig = this.modal.querySelector('.shortcuts-config');
    if (!shortcutsConfig) return;

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

  public async show() {
    this.shortcuts = await ipcRenderer.invoke('get-shortcuts');
    await this.updateForm();
    this.modal.style.display = 'flex';
  }

  public hide() {
    this.modal.style.display = 'none';
  }

  private async updateForm() {
    for (let i = 1; i <= 10; i++) {
      const shortcut = this.shortcuts[`shortcut${i}`];
      const commandInput = document.getElementById(`shortcut${i}Command`) as HTMLInputElement;
      const descriptionInput = document.getElementById(`shortcut${i}Description`) as HTMLInputElement;
      
      if (commandInput && descriptionInput) {
        commandInput.value = shortcut?.command || '';
        descriptionInput.value = shortcut?.description || '';
      }
    }

    const alwaysOnTopCheckbox = document.getElementById('alwaysOnTop') as HTMLInputElement;
    const transparencySlider = document.getElementById('transparency') as HTMLInputElement;
    
    if (alwaysOnTopCheckbox) {
      alwaysOnTopCheckbox.checked = await ipcRenderer.invoke('get-setting', 'alwaysOnTop') as boolean;
    }
    if (transparencySlider) {
      const transparency = await ipcRenderer.invoke('get-setting', 'transparency') as number;
      transparencySlider.value = String((transparency || 0.8) * 100);
    }
  }

  private async saveSettings() {
    const newShortcuts: { [key: string]: Shortcut } = {};
    
    for (let i = 1; i <= 10; i++) {
      const commandInput = document.getElementById(`shortcut${i}Command`) as HTMLInputElement;
      const descriptionInput = document.getElementById(`shortcut${i}Description`) as HTMLInputElement;
      
      if (commandInput && descriptionInput) {
        newShortcuts[`shortcut${i}`] = {
          command: commandInput.value,
          description: descriptionInput.value
        };
      }
    }

    const alwaysOnTopCheckbox = document.getElementById('alwaysOnTop') as HTMLInputElement;
    const transparencySlider = document.getElementById('transparency') as HTMLInputElement;

    await ipcRenderer.invoke('update-settings', {
      shortcuts: newShortcuts,
      alwaysOnTop: alwaysOnTopCheckbox?.checked ?? true,
      transparency: transparencySlider ? parseInt(transparencySlider.value) / 100 : 0.8
    });

    this.hide();
  }
} 