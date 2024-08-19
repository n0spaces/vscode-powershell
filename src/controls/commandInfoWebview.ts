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

const commonParameterNames = [
    "Debug",
    "ErrorAction",
    "ErrorVariable",
    "InformationAction",
    "InformationVariable",
    "OutVariable",
    "OutBuffer",
    "PipelineVariable",
    "ProgressAction",
    "Verbose",
    "WarningAction",
    "WarningVariable",
];

// Default parameter set to use if a command contains no parameter sets
const fallbackParameterSet = {
    name: "__AllParameterSets",
    isDefault: false,
    parameters: [],
};

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

    // Set fallback if parameterSets is empty
    if (command.parameterSets.length === 0) {
        command.parameterSets.push(fallbackParameterSet);
    }

    const options = [];
    const forms = [];
    for (const parameterSet of command.parameterSets) {
        const isDefault = parameterSet.isDefault || command.parameterSets.length === 1;
        options.push(new Option(parameterSet.name, parameterSet.name, isDefault, isDefault));

        // Create <form> for parameters in this ParameterSet
        const form = document.createElement("form");
        form.name = parameterSet.name;
        form.hidden = !(parameterSet.isDefault || command.parameterSets.length === 1);
        forms.push(form);

        const commonParametersContainer = document.createElement("details");

        for (const parameter of parameterSet.parameters) {
            // Create <div> that contains the <label> and <input> for this parameter
            const parameterDiv = document.createElement("div");
            parameterDiv.className = "parameterInputGroup";

            // Create tooltip text that contains type, position, mandatory/optional, etc.
            const tooltipLines = [`Type: ${parameter.parameterType.split(",")[0]}`];
            parameter.position >= 0 && tooltipLines.push(`Position: ${parameter.position}`);
            tooltipLines.push(parameter.isMandatory ? "Mandatory" : "Optional");
            parameter.valueFromPipeline && tooltipLines.push("Can receive value from pipeline");
            parameterDiv.title = tooltipLines.join("\n");

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

            // Append common parameters to the details element
            if (commonParameterNames.includes(parameter.name)) {
                commonParametersContainer.appendChild(parameterDiv);
            } else {
                form.appendChild(parameterDiv);
            }
        }

        if (commonParametersContainer.childElementCount > 0) {
            const summary = document.createElement("summary");
            summary.textContent = "Common Parameters";
            commonParametersContainer.appendChild(summary);
            form.appendChild(commonParametersContainer);
        }

        // Show a message if there are no parameters
        if (form.childElementCount === 0) {
            form.innerHTML = "<p>There are no parameters.</p>";
            if (command.moduleName) {
                form.innerHTML += `<p>You may need to import the ${command.moduleName} module.</p>`;
                // TODO: Add Import-Module button
            }
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
        // Only include parameters with non-empty values
        const input = inputs.item(i)!;
        if (input.type === "checkbox" && input.checked)
            parameters[input.name] = null; // Use null value for
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
