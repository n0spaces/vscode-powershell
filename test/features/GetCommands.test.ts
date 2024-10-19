// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as vscode from "vscode";
import { CommandInfoViewProvider } from "../../src/features/GetCommands";
import * as sinon from "sinon";

describe("GetCommands feature", function() {
    describe("CommandInfoViewProvider", function () {
        let provider: CommandInfoViewProvider;
        const fakeCommandExplorerRefresh = sinon.fake.returns(Promise.resolve());
        const fakeWebviewView = {
            viewType: "",
            webview: {
                options: {},
                html: "",
                onDidReceiveMessage: sinon.fake(),
                postMessage: sinon.fake(),
                asWebviewUri: sinon.fake(uri => uri),
                cspSource: ""
            },
            onDidDispose: sinon.fake(),
            visible: true,
            onDidChangeVisibility: sinon.fake(),
            show: sinon.fake(),
        };

        before(function() {
            provider = new CommandInfoViewProvider(vscode.Uri.file("blah"), fakeCommandExplorerRefresh);
            provider.resolveWebviewView(fakeWebviewView);
        });

        it("Replaces active selection with command expression on 'insert' action", async function() {
            // Open a new text document and select some text
            const document = await vscode.workspace.openTextDocument({
                language: "PowerShell",
                content: "# This content should be replaced"
            });
            await vscode.window.showTextDocument(document); // sets activeTextEditor
            vscode.window.activeTextEditor!.selection = new vscode.Selection(0, 0, 0, 33);

            // Send the submit message
            await provider.onMessage({
                type: "submit",
                payload: {
                    action: "insert",
                    expression: "Invoke-Example -Switch -Foo $Bar",
                },
            });

            // Get the text then close the document
            const actualText = document.getText();
            await vscode.window.tabGroups.close(vscode.window.tabGroups.activeTabGroup);

            assert.strictEqual(actualText, "Invoke-Example -Switch -Foo $Bar");
        });

        it("Copies command expression to clipboard on 'copy' action", async function() {
            await provider.onMessage({
                type: "submit",
                payload: {
                    action: "copy",
                    expression: "ConvertTo-Json -InputObject foo,bar,baz -Compress",
                }
            });
            const clipboardText = await vscode.env.clipboard.readText();
            assert.strictEqual(clipboardText, "ConvertTo-Json -InputObject foo,bar,baz -Compress");
        });

        it("Updates persisted webview state on 'setState' message", async function() {
            const sampleState = {
                command: {
                    name: "Invoke-SampleCommand",
                    defaultParameterSet: "Foo",
                    moduleName: "SampleModule",
                    parameters: {},
                    parameterSets: [{ name: "Foo", isDefault: true, parameters: [] }],
                },
                parameterSetInputs: { Foo: [] },
                selectedParameterSet: "Foo",
            };
            await provider.onMessage({ type: "setState", payload: { newState: sampleState } });

            // When the webview becomes visible, the provider should send a setState message with the newly saved state
            fakeWebviewView.onDidChangeVisibility.lastCall.yield(); // trigger provider.onViewChangedVisibility()
            sinon.assert.calledWith(fakeWebviewView.webview.postMessage, {
                type: "setState",
                payload: { newState: sampleState },
            });
        });

        it("Sends 'commandChanged' message on setCommand", async function() {
            const persistedState = { command: null, parameterSetInputs: {}, selectedParameterSet: "" };
            const selectedCommand = {
                Name: "Invoke-Sample",
                ModuleName: "SampleModule",
                Parameters: {},
                ParameterSets: [{ name: "Bar", isDefault: true, parameters: [] }],
                defaultParameterSet: "Bar",
            };
            const expectedMessage = {
                type: "commandChanged",
                payload: {
                    command: {
                        name: selectedCommand.Name,
                        moduleName: selectedCommand.ModuleName,
                        parameters: selectedCommand.Parameters,
                        parameterSets: selectedCommand.ParameterSets,
                        defaultParameterSet: selectedCommand.defaultParameterSet,
                    }
                }
            };

            // Update webviewState in the provider so we can test that it's not sent later
            await provider.onMessage({ type: "setState", payload: { newState: persistedState } });

            // Select a new command in the explorer
            // @ts-expect-error partial Command
            provider.setCommand(selectedCommand);

            // Should immediately send commandChanged
            sinon.assert.calledWith(fakeWebviewView.webview.postMessage, expectedMessage);

            // Should send commandChanged after the webview becomes visible
            // (Should NOT send setState, since a new command was selected after the state was last updated)
            fakeWebviewView.webview.postMessage.resetHistory();
            fakeWebviewView.onDidChangeVisibility.lastCall.yield(); // trigger provider.onViewChangedVisibility()
            sinon.assert.calledWith(fakeWebviewView.webview.postMessage, expectedMessage);
        });
    });
});
