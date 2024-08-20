// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as vscode from "vscode";
import { RequestType0 } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { LanguageClientConsumer } from "../languageClientConsumer";
import { getSettings } from "../settings";
import { EvaluateRequestType } from "./Console";

export interface ICommand {
    name: string;
    moduleName: string;
    defaultParameterSet: string;
    parameterSets: CommandParameterSetInfo[];
    parameters: Record<string, object>;
}

interface CommandParameterSetInfo {
    isDefault: boolean,
    name: string,
    parameters: CommandParameterInfo[],
}

interface CommandParameterInfo {
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
 * A PowerShell Command listing feature. Implements a treeview control.
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

        this.commandInfoViewProvider = new CommandInfoViewProvider(context.extensionUri);
        this.disposables.push(
            vscode.window.registerWebviewViewProvider(CommandInfoViewProvider.viewType, this.commandInfoViewProvider)
        );

        this.commandsExplorerTreeView.onDidChangeSelection((ev) => {
            ev.selection.length === 1 && this.commandInfoViewProvider.setCommand(ev.selection[0]);
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
        const filteredResult = result.filter((command) => (!excludeFilter.includes(command.moduleName.toLowerCase())));
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

export type CommandInfoViewMessage =
    | { type: "commandChanged", command: ICommand }
    | { type: "submit", action: "run" | "insert" | "copy", commandName: string, parameters: Record<string, string | null> }
    | { type: "importRequested", moduleName: string };

class CommandInfoViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "PowerShell.CommandInfoView";
    private view?: vscode.WebviewView;
    private selectedCommand?: Command;

    constructor(private readonly extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): Thenable<void> | void {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this.extensionUri],
        };
        webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(m => this.onMessage(m));
        webviewView.onDidChangeVisibility(() => {
            this.selectedCommand && this.setCommand(this.selectedCommand);
        });
    }

    public setCommand(command: Command): void {
        this.selectedCommand = command;
        void this.postMessage({
            type: "commandChanged",
            command: {
                name: command.Name,
                moduleName: command.ModuleName,
                parameters: command.Parameters,
                parameterSets: command.ParameterSets,
                defaultParameterSet: command.defaultParameterSet,
            }
        });
    }

    private async postMessage(message: CommandInfoViewMessage): Promise<void> {
        await this.view?.webview.postMessage(message);
    }

    private async onReceivedSubmitMessage(message: CommandInfoViewMessage): Promise<void> {
        if (message.type !== "submit") return;
        // Build array of commandName, parameters and values, then join to create full expression string
        const expression = [
            message.commandName,
            ...Object.entries(message.parameters)
                .flatMap(([name, value]) => [`-${name}`, value])
                .filter(s => s !== null), // null values indicate a SwitchParameter
        ].join(" ");

        switch(message.action) {
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
            return;
        }
    }

    private async onReceivedImportRequest(message: CommandInfoViewMessage): Promise<void> {
        if (message.type !== "importRequested") return;

        const client = await LanguageClientConsumer.getLanguageClient();
        await client.sendRequest(EvaluateRequestType, { expression: `Import-Module "${message.moduleName}"` });
    }

    private async onMessage(message: CommandInfoViewMessage): Promise<void> {
        switch (message.type) {
        case "submit": return this.onReceivedSubmitMessage(message);
        case "importRequested": return this.onReceivedImportRequest(message);
        }
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, "dist", "controls", "commandInfoWebview.js")
        );

        // Install `Tobermory.es6-string-html` to get syntax highlighting below
        // TODO: content security policy
        return /*html*/ `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Command Info</title>
                <style>
                    body {
                        overflow-wrap: break-word;
                    }
                    #commandName {
                        font-size: 1.5em;
                        margin-block-end: 4px;
                    }
                    #commandModule {
                        font-style: italic;
                        margin-block-end: 4px;
                    }
                    select {
                        color: var(--vscode-dropdown-foreground);
                        background-color: var(--vscode-dropdown-background);
                        border: 1px solid var(--vscode-dropdown-border);
                        height: 24px;
                        width: 100%;
                        margin: 4px 0;
                        font-family: inherit;
                    }
                    .parameterInputGroup {
                        display: flex;
                        flex-wrap: wrap;
                        margin: 4px 0;
                    }
                    label {
                        margin: auto 4px auto 0;
                    }
                    input[type="text"] {
                        color: var(--vscode-input-foreground);
                        background-color: var(--vscode-input-background);
                        border: 1px solid var(--vscode-dropdown-border);
                        height: 20px;
                        min-width: 100px;
                        flex-grow: 1;
                        flex-basis: 100px;
                    }
                    input[type="checkbox"] {
                        color: var(--vscode-checkbox-foreground);
                        background-color: var(--vscode-checkbox-background);
                        border: 1px solid var(--vscode-checkbox-border);
                        height: 16px;
                        width: 16px;
                    }
                    details {
                        border: solid 1px var(--vscode-dropdown-border);
                        padding: 4px 8px;
                        margin: 8px 0;
                    }
                    button {
                        cursor: pointer;
                        border: 1px solid var(--vscode-button-border, transparent);
                        border-radius: 2px;
                        padding: 4px 6px;
                        font-family: inherit;
                    }
                    .button-primary {
                        color: var(--vscode-button-foreground);
                        background-color: var(--vscode-button-background);
                    }
                    .button-primary:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    .button-secondary {
                        color: var(--vscode-button-secondaryForeground);
                        background-color: var(--vscode-button-secondaryBackground);
                    }
                    .button-secondary:hover {
                        background-color: var(--vscode-button-secondaryHoverBackground);
                    }
                </style>
            </head>
            <body>
                <p id="welcomeMessage">Select a command from the Command Explorer.</p>
                <h1 id="commandName"></h1>
                <div id="commandModule"></div>
                <select id="selectParameterSet" hidden></select>
                <div id="parameterForms"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }
}
