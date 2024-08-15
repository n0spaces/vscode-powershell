// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as vscode from "vscode";
import { RequestType0 } from "vscode-languageclient";
import { LanguageClient } from "vscode-languageclient/node";
import { LanguageClientConsumer } from "../languageClientConsumer";
import { getSettings } from "../settings";

interface ICommand {
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
    helpMessage: string;
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
            this.commandInfoViewProvider.setCommand(ev.selection.length === 1 ? ev.selection[0] : null);
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

type CommandInfoViewMessage =
    | { type: "commandChanged", command: ICommand | null };

class CommandInfoViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = "PowerShell.CommandInfoView";
    private view?: vscode.WebviewView;

    constructor(private readonly extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ): Thenable<void> | void {
        this.view = webviewView;
        this.view.webview.options = {

            // TODO: webview options
        };
        this.view.webview.html = this.getHtmlForWebview();
    }

    public setCommand(command: Command | null): void {
        void this.postMessage({
            type: "commandChanged",
            command: command === null ? null : {
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

    private getHtmlForWebview(): string {
        return /*html*/ `<!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Command Info</title>
            </head>
            <body>
                <h1>Command Info</h1>
                <p>Hello, world!</p>
            </body>
            </html>
        `;
    }
}
