// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as vscode from "vscode";
import { RequestType0 } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { LanguageClientConsumer } from "../languageClientConsumer";
import { getSettings } from "../settings";
import { EvaluateRequestType } from "./Console";
import { sleep } from "../utils";
import { CommandInfoViewState } from "../controls/commandInfoViewModel";
import crypto from "crypto";

export interface ICommand {
    name: string;
    moduleName: string;
    defaultParameterSet: string;
    parameterSets: CommandParameterSetInfo[];
    parameters: Record<string, object>;
}

export interface CommandParameterSetInfo {
    isDefault: boolean,
    name: string,
    parameters: CommandParameterInfo[],
}

export interface CommandParameterInfo {
    aliases: string[];
    attributes: object[];
    helpMessage: string | null;
    isDynamic: boolean;
    isMandatory: boolean;
    name: string;
    parameterType: string;
    position: number;
    valueFromPipeline: boolean;
    valueFromPipelineByPropertyName: boolean;
    valueFromRemainingArguments: boolean;
}

/**
 * RequestType sent over to PSES.
 * Expects: ICommand to be returned
 */
export const GetCommandRequestType = new RequestType0<ICommand[], void>("powerShell/getCommand");

/**
 * A PowerShell Command listing feature. Implements a TreeView and WebviewView control
 */
export class GetCommandsFeature extends LanguageClientConsumer {
    private disposables: vscode.Disposable[];
    private commandsExplorerProvider: CommandsExplorerProvider;
    private commandsExplorerTreeView: vscode.TreeView<Command>;
    private commandInfoViewProvider: CommandInfoViewProvider;

    constructor(context: vscode.ExtensionContext) {
        super();
        this.disposables = [
            vscode.commands.registerCommand("PowerShell.RefreshCommandsExplorer",
                async () => { await this.CommandExplorerRefresh(); }),
            vscode.commands.registerCommand("PowerShell.InsertCommand", async (item) => { await this.InsertCommand(item); })
        ];
        this.commandsExplorerProvider = new CommandsExplorerProvider();

        this.commandsExplorerTreeView = vscode.window.createTreeView<Command>("PowerShellCommands",
            { treeDataProvider: this.commandsExplorerProvider });

        // Refresh the command explorer when the view is visible
        this.commandsExplorerTreeView.onDidChangeVisibility(async (e) => {
            if (e.visible) {
                await this.CommandExplorerRefresh();
            }
        });

        this.commandInfoViewProvider = new CommandInfoViewProvider(
            context.extensionUri,
            () => this.CommandExplorerRefresh(),
        );
        this.disposables.push(
            vscode.window.registerWebviewViewProvider(CommandInfoViewProvider.viewType, this.commandInfoViewProvider)
        );

        // Update the Command Info view when a new command is selected
        this.commandsExplorerTreeView.onDidChangeSelection((ev) => {
            if (ev.selection.length === 1) {
                this.commandInfoViewProvider.setCommand(ev.selection[0]);
            }
        });

        this.commandsExplorerProvider.onDidChangeTreeData(async () => {
            // If a command is selected, send the updated command to the Command Info view
            // Pause for a moment to wait for the selected command to be updated
            await sleep(500);
            if (this.commandsExplorerTreeView.selection.length === 1) {
                this.commandInfoViewProvider.setCommand(this.commandsExplorerTreeView.selection[0]);
            }
        });
    }

    public dispose(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
    }

    public override onLanguageClientSet(_languageClient: LanguageClient): void {
        if (this.commandsExplorerTreeView.visible) {
            void vscode.commands.executeCommand("PowerShell.RefreshCommandsExplorer");
        }
    }

    private async CommandExplorerRefresh(): Promise<void> {
        const client = await LanguageClientConsumer.getLanguageClient();
        const result = await client.sendRequest(GetCommandRequestType);
        const exclusions = getSettings().sideBar.CommandExplorerExcludeFilter;
        const excludeFilter = exclusions.map((filter: string) => filter.toLowerCase());
        const filteredResult = result.filter((command, i, arr) =>
            (!excludeFilter.includes(command.moduleName.toLowerCase())) &&
            (command.name !== arr[i-1]?.name) // Remove duplicates
        );
        this.commandsExplorerProvider.powerShellCommands = filteredResult.map(toCommand);
        this.commandsExplorerProvider.refresh();
    }

    private async InsertCommand(item: { Name: string; }): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (editor === undefined) {
            return;
        }

        const sls = editor.selection.start;
        const sle = editor.selection.end;
        const range = new vscode.Range(sls.line, sls.character, sle.line, sle.character);
        await editor.edit((editBuilder) => {
            editBuilder.replace(range, item.Name);
        });
    }
}

class CommandsExplorerProvider implements vscode.TreeDataProvider<Command> {
    public readonly onDidChangeTreeData: vscode.Event<Command | undefined>;
    public powerShellCommands: Command[] = [];
    private didChangeTreeData: vscode.EventEmitter<Command | undefined> = new vscode.EventEmitter<Command>();

    constructor() {
        this.onDidChangeTreeData = this.didChangeTreeData.event;
    }

    public refresh(): void {
        this.didChangeTreeData.fire(undefined);
    }

    public getTreeItem(element: Command): vscode.TreeItem {
        return element;
    }

    public getChildren(_element?: Command): Thenable<Command[]> {
        return Promise.resolve(this.powerShellCommands);
    }
}

function toCommand(command: ICommand): Command {
    return new Command(
        command.name,
        command.moduleName,
        command.defaultParameterSet,
        command.parameterSets,
        command.parameters,
    );
}

class Command extends vscode.TreeItem {
    constructor(
        public readonly Name: string,
        public readonly ModuleName: string,
        public readonly defaultParameterSet: string,
        public readonly ParameterSets: CommandParameterSetInfo[],
        public readonly Parameters: Record<string, object>,
        public override readonly collapsibleState = vscode.TreeItemCollapsibleState.None,
    ) {
        super(Name, collapsibleState);
    }

    public getTreeItem(): vscode.TreeItem {
        return {
            label: this.label,
            collapsibleState: this.collapsibleState,
        };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/require-await
    public async getChildren(_element?: any): Promise<Command[]> {
        // Returning an empty array because we need to return something.
        return [];
    }
}

/**
 * Messages passed between CommandInfoViewProvider and CommandInfoViewModel.
 */
export type CommandInfoViewMessage =
    | CommandInfoViewCommandChangedMessage
    | CommandInfoViewSubmitMessage
    | CommandInfoViewImportMessage
    | CommandInfoViewSetStateMessage;

/** Sent to viewmodel when a new command is selected in the command explorer. */
interface CommandInfoViewCommandChangedMessage { type: "commandChanged"; payload: { command: ICommand } }
/** Sent to provider when one of the submit actions (run/insert/copy) are triggered in the webview. */
interface CommandInfoViewSubmitMessage { type: "submit"; payload: CommandInfoViewSubmitMessagePayload }
/** Sent to provider when the import action is triggered in the webview. */
interface CommandInfoViewImportMessage { type: "import"; payload: { moduleName: string } }
/** Bidirectional message sent when the viewmodel or provider should update its current webview state */
interface CommandInfoViewSetStateMessage { type: "setState"; payload: { newState: CommandInfoViewState } }

interface CommandInfoViewSubmitMessagePayload {
    action: "run" | "insert" | "copy";
    expression: string;
}

/**
 * Provider for the Command Info webview view.
 */
export class CommandInfoViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "PowerShell.CommandInfoView";
    private view?: vscode.WebviewView;
    private selectedCommand?: ICommand;

    /**
     * Store the webview state here so we don't lose the input values when the view is hidden.
     *
     * We use this instead of getState/setState in acquireVsCodeApi
     * because those functions persist state across restarts.
     */
    private webviewState: CommandInfoViewState | null = null;

    constructor(
        private readonly extensionUri: vscode.Uri,
        private commandExplorerRefresh: () => Promise<void>
    ) { }

    public resolveWebviewView(webviewView: vscode.WebviewView): void {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(m => this.onMessage(m));
        webviewView.onDidChangeVisibility(() => this.onViewChangedVisibility());
    }

    /**
     * Post a message to the webview
     */
    private async postMessage(message: CommandInfoViewMessage): Promise<void> {
        await this.view?.webview.postMessage(message);
    }

    /**
     * Set selectedCommand and update it in the webview
     */
    public setCommand(command: Command): void {
        this.selectedCommand = {
            name: command.Name,
            moduleName: command.ModuleName,
            parameters: command.Parameters,
            parameterSets: command.ParameterSets,
            defaultParameterSet: command.defaultParameterSet,
        };
        void this.postMessage({ type: "commandChanged", payload: { command: this.selectedCommand } });
    }

    /**
     * If the webview becomes visible, send the persisted state if we have it stored.
     * Otherwise, send the currently selected command if there is one.
     */
    private async onViewChangedVisibility(): Promise<void> {
        if (!this.view?.visible) {
            return;
        }
        if (this.webviewState) {
            await this.postMessage({ type: "setState", payload: { newState: this.webviewState } });
        }
        if (this.selectedCommand) {
            await this.postMessage({ type: "commandChanged", payload: { command: this.selectedCommand } });
        }
    }

    /**
     * Process the run/insert/copy action requested from the webview.
     */
    private async onSubmitMessage({ action, expression }: CommandInfoViewSubmitMessagePayload): Promise<void> {
        // Process action
        switch(action) {
        case "run": {
            const client = await LanguageClientConsumer.getLanguageClient();
            await client.sendRequest(EvaluateRequestType, { expression });
            return;
        }
        case "insert": {
            const editor = vscode.window.activeTextEditor;
            await editor?.edit(editBuilder => {
                editBuilder.replace(editor.selection, expression);
            });
            return;
        }
        case "copy":
            await vscode.env.clipboard.writeText(expression);
            void vscode.window.showInformationMessage("Command copied to clipboard.");
            return;
        }
    }

    /**
     * Evaluate an Import-Module expression, then refresh the command explorer.
     */
    private async onImportMessage(module: string): Promise<void> {
        const client = await LanguageClientConsumer.getLanguageClient();
        await client.sendRequest(EvaluateRequestType, { expression: `Import-Module "${module}"` });
        await this.commandExplorerRefresh();
    }

    /**
     * Update the persisted webview state with the value given by the webview.
     */
    private onSetStateMessage(newState: CommandInfoViewState): void {
        this.webviewState = newState;
    }

    /**
     * Handle messages received from the webview.
     */
    public async onMessage(message: CommandInfoViewMessage): Promise<void> {
        switch (message.type) {
        case "submit":
            await this.onSubmitMessage(message.payload);
            return;
        case "import":
            await this.onImportMessage(message.payload.moduleName);
            return;
        case "setState":
            this.onSetStateMessage(message.payload.newState);
            return;
        }
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, "dist", "controls", "commandInfoWebview.js")
        );
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, "dist", "controls", "commandInfoWebview.css")
        );
        const nonce = crypto.randomBytes(16).toString("base64");

        // Content Security Policy
        // https://code.visualstudio.com/api/extension-guides/webview#content-security-policy
        const csp = `default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource}; script-src 'nonce-${nonce}'`;

        // Install `Tobermory.es6-string-html` to get syntax highlighting below
        return /*html*/ `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Command Info</title>
                <meta http-equiv="Content-Security-Policy" content="${csp}">
                <link href="${styleUri}" rel="stylesheet">
            </head>
            <body>
                <p id="welcome-message">Select a command from the Command Explorer.</p>
                <form id="command-form" class="vstack" hidden>
                    <div>
                        <h1 id="command-name"></h1>
                        <div id="module-name"></div>
                    </div>
                    <select id="select-parameter-set"></select>
                    <div id="standard-parameters-group" class="parameters-group"></div>
                    <details>
                        <summary>Common Parameters</summary>
                        <div id="common-parameters-group" class="parameters-group"></div>
                    </details>
                    <div id="no-parameters-message" hidden>There are no parameters.</div>
                    <div id="not-imported-message" class="vstack" hidden>
                        <div>You may need to import the module first before parameters are visible here.</div>
                        <button type="button" id="import-module-button" class="button-primary">Import-Module</button>
                    </div>
                    <div class="button-group">
                        <button type="submit" class="button-primary" name="__action" value="run">Run</button>
                        <button type="submit" class="button-secondary" name="__action" value="insert">Insert</button>
                        <button type="submit" class="button-secondary" name="__action" value="copy">Copy</button>
                    </div>
                </form>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }
}
