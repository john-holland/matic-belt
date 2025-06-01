import * as vscode from 'vscode';
import { Scanner } from '../src/scanner';
import { MUDClient } from '../src/mud';

export function activate(context: vscode.ExtensionContext) {
    let scanner: Scanner | null = null;
    let mudClient: MUDClient | null = null;

    // Start scanning command
    let startScanning = vscode.commands.registerCommand('bat-belt-scanner.startScanning', async () => {
        try {
            if (!scanner) {
                scanner = new Scanner();
                await scanner.connectToMUD();
            }
            vscode.window.showInformationMessage('Scanner started');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to start scanner: ${error}`);
        }
    });

    // Stop scanning command
    let stopScanning = vscode.commands.registerCommand('bat-belt-scanner.stopScanning', async () => {
        try {
            if (scanner) {
                await scanner.disconnectFromMUD();
                scanner = null;
            }
            vscode.window.showInformationMessage('Scanner stopped');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to stop scanner: ${error}`);
        }
    });

    // Connect to MUD command
    let connectToMUD = vscode.commands.registerCommand('bat-belt-scanner.connectToMUD', async () => {
        try {
            if (!mudClient) {
                mudClient = new MUDClient();
                await mudClient.connect();
                vscode.window.showInformationMessage('Connected to MUD');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to connect to MUD: ${error}`);
        }
    });

    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = "$(radio-tower) Scanner";
    statusBarItem.tooltip = "Bat Belt Scanner";
    statusBarItem.command = 'bat-belt-scanner.startScanning';
    statusBarItem.show();

    // Create output channel
    const outputChannel = vscode.window.createOutputChannel('Bat Belt Scanner');

    // Register commands
    context.subscriptions.push(
        startScanning,
        stopScanning,
        connectToMUD,
        statusBarItem,
        outputChannel
    );

    // Configuration change handler
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('batBeltScanner')) {
                const config = vscode.workspace.getConfiguration('batBeltScanner');
                const mudServerUrl = config.get<string>('mudServerUrl');
                const scanInterval = config.get<number>('scanInterval');

                if (mudClient) {
                    mudClient.disconnect();
                    mudClient = null;
                }

                if (scanner) {
                    scanner.disconnectFromMUD();
                    scanner = null;
                }

                vscode.window.showInformationMessage('Scanner configuration updated');
            }
        })
    );
}

export function deactivate() {
    // Cleanup will be handled by the extension host
} 