// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as assert from "assert";
import * as vscode from "vscode";
import { CommandInfoViewMessage, CommandInfoViewProvider } from "../../src/features/GetCommands";

describe("GetCommands feature", function() {
    const provider = new CommandInfoViewProvider(vscode.Uri.file("blah"), () => Promise.resolve());

    describe("Command Info 'insert' action", function () {
        let document: vscode.TextDocument;
        const message: CommandInfoViewMessage = {
            type: "submit",
            payload: {
                action: "insert",
                commandName: "Invoke-Example",
                parameters: [
                    ["Switch", true],
                    ["Foo", "$Bar"],
                ],
            }
        };
        const expectedText = "Invoke-Example -Switch -Foo $Bar";

        before("Create file", async function () {
            document = await vscode.workspace.openTextDocument({
                language: "PowerShell",
                content: "# This content should be replaced"
            });
            await vscode.window.showTextDocument(document); // sets activeTextEditor
            vscode.window.activeTextEditor!.selection = new vscode.Selection(0, 0, 0, 33);
        });
        after(async function() {
            await vscode.window.tabGroups.close(vscode.window.tabGroups.activeTabGroup);
        });
        it("Replaces active selection with command expression", async function() {
            await provider.onMessage(message);
            assert.strictEqual(document.getText(), expectedText);
        });
    });

    describe("Command Info 'copy' action", function () {
        const message: CommandInfoViewMessage = {
            type: "submit",
            payload: {
                action: "copy",
                commandName: "ConvertTo-Json",
                parameters: [
                    ["InputObject", "foo,bar,baz"],
                    ["Compress", true],
                ],
            }
        };
        const expectedText = "ConvertTo-Json -InputObject foo,bar,baz -Compress";

        it("Copies command expression to clipboard", async function() {
            await provider.onMessage(message);
            const clipboardText = await vscode.env.clipboard.readText();
            assert.strictEqual(clipboardText, expectedText);
        });
    });
});
