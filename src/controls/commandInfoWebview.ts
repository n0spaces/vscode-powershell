// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { CommandInfoViewMessage, ICommand } from "../features/GetCommands";

declare global {
    function acquireVsCodeApi<T = unknown>(): {
        postMessage(message: CommandInfoViewMessage): void;
        getState(): T | undefined;
        setState<T>(newState: T): T;
    };
}

let vscode: ReturnType<typeof acquireVsCodeApi>;

let elementCommandName: HTMLElement;
let elementCommandModule: HTMLElement;
let selectParameterSet: HTMLSelectElement;
let divParameterForms: HTMLElement;

let commandName = "";

document.addEventListener("DOMContentLoaded", () => {
    vscode = acquireVsCodeApi();

    elementCommandName = document.getElementById("commandName")!;
    elementCommandModule = document.getElementById("commandModule")!;
    selectParameterSet = document.getElementById("selectParameterSet") as HTMLSelectElement;
    divParameterForms = document.getElementById("parameterForms")!;

    selectParameterSet.onchange = onParameterSetSelectionChanged;
    divParameterForms.onsubmit = onFormSubmit;
});

window.onmessage = (ev: MessageEvent<CommandInfoViewMessage>): void => {
    switch (ev.data.type) {
    case "commandChanged":
        loadCommand(ev.data.command);
        break;
    }
};

function loadCommand(command: ICommand): void {
    commandName = command.name;
    elementCommandName.textContent = command.name;
    elementCommandModule.textContent = command.moduleName;
    selectParameterSet.options.length = 0;

    const options = [];
    const forms = [];
    for (const parameterSet of command.parameterSets) {
        options.push(new Option(parameterSet.name, parameterSet.name, parameterSet.isDefault, parameterSet.isDefault));

        const form = document.createElement("form");
        form.name = parameterSet.name;
        form.style.border = "solid 2px black";
        form.hidden = !parameterSet.isDefault;
        forms.push(form);

        for (const parameter of parameterSet.parameters) {
            const parameterDiv = document.createElement("div");

            // TODO: Do we want to store a persisted state for these inputs in case the webview is closed?
            const input = document.createElement("input");
            input.name = parameter.name;
            input.type = parameter.parameterType.startsWith("System.Management.Automation.SwitchParameter") ? "checkbox" : "text";
            input.id = `(${parameterSet.name})${parameter.name}`;
            input.value = "";

            const label = document.createElement("label");
            label.htmlFor = input.id;
            label.textContent = parameter.name + (parameter.isMandatory ? "*" : "");

            parameterDiv.append(label, input);
            form.appendChild(parameterDiv);
        }

        const submitsDiv = document.createElement("div");
        submitsDiv.innerHTML = /*html*/ `
            <button type="submit" name="__action" value="run">Run</button>
            <button type="submit" name="__action" value="insert">Insert</button>
            <button type="submit" name="__action" value="copy">Copy</button>
        `;
        form.appendChild(submitsDiv);
    }

    selectParameterSet.replaceChildren(...options);
    divParameterForms.replaceChildren(...forms);

    // Only show select box if there's more than one ParameterSet
    selectParameterSet.hidden = selectParameterSet.options.length <= 1;
}

function onParameterSetSelectionChanged(): void {
    const selectedOption = selectParameterSet.selectedOptions.item(0);
    const parameterSet = selectedOption?.value;
    const forms = divParameterForms.getElementsByTagName("form");
    for (let i = 0; i < forms.length; i++) {
        const form = forms.item(i)!;
        form.hidden = form.name !== parameterSet;
    }
}

function onFormSubmit(ev: SubmitEvent): void {
    ev.preventDefault();
    const form = ev.target as HTMLFormElement;
    const formData = new FormData(form, ev.submitter);

    const parameters: Record<string, string | null> = {};
    const inputs = form.getElementsByTagName("input");
    for (let i = 0; i < inputs.length; i++) {
        const input = inputs.item(i)!;
        if (input.type === "checkbox" && input.checked)
            parameters[input.name] = null;
        else if (input.value !== "")
            parameters[input.name] = input.value;
    }

    vscode.postMessage({
        type: "submit",
        action: formData.get("__action") as "run" | "insert" | "copy",
        commandName: commandName,
        parameters: parameters,
    });
}
