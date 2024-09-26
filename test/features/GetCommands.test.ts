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
            visible: false,
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
                    commandName: "Invoke-Example",
                    parameters: [["Switch", true], ["Foo", "$Bar"]],
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
                    commandName: "ConvertTo-Json",
                    parameters: [["InputObject", "foo,bar,baz"], ["Compress", true]],
                }
            });
            const clipboardText = await vscode.env.clipboard.readText();
            assert.strictEqual(clipboardText, "ConvertTo-Json -InputObject foo,bar,baz -Compress");
        });

        it("Does not respond to getState if there is no state", async function() {
            await provider.onMessage({ type: "getState" });
            sinon.assert.notCalled(fakeWebviewView.webview.postMessage);
        });

        it("Handles setState and getState messages", async function() {
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
            await provider.onMessage({ type: "getState" });

            // Should respond getStateResponse with the state received from setState
            sinon.assert.calledWith(fakeWebviewView.webview.postMessage, {
                type: "getStateResponse",
                payload: { state: sampleState },
            });
        });

        it("Sends 'commandChanged' message on setCommand", function() {
            // @ts-expect-error partial Command
            provider.setCommand({
                Name: "Invoke-Sample",
                ModuleName: "SampleModule",
                Parameters: {},
                ParameterSets: [{ name: "Bar", isDefault: true, parameters: [] }],
                defaultParameterSet: "Bar",
            });
            sinon.assert.calledWith(fakeWebviewView.webview.postMessage, {
                type: "commandChanged",
                payload:{
                    command: {
                        name: "Invoke-Sample",
                        moduleName: "SampleModule",
                        parameters: {},
                        parameterSets: [{ name: "Bar", isDefault: true, parameters: [] }],
                        defaultParameterSet: "Bar",
                    },
                },
            });
        });
    });
});
