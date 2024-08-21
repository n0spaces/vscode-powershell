// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import "./commandInfoWebview.css";
import type { CommandInfoViewMessage, ICommand } from "../features/GetCommands";

declare global {
    function acquireVsCodeApi<T = unknown>(): {
        postMessage(message: CommandInfoViewMessage): void;
        getState(): T | undefined;
        setState<T>(newState: T): T;
    };
}

let vscode: ReturnType<typeof acquireVsCodeApi>;

let welcomeMessage: HTMLElement;
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

    welcomeMessage = document.getElementById("welcomeMessage")!;
    elementCommandName = document.getElementById("commandName")!;
    elementCommandModule = document.getElementById("commandModule")!;
    selectParameterSet = document.getElementById("selectParameterSet") as HTMLSelectElement;
    divParameterForms = document.getElementById("parameterForms")!;

    selectParameterSet.onchange = onParameterSetSelectionChanged;
    divParameterForms.onsubmit = onFormSubmit;
});

// Handle messages sent by the webview provider
window.onmessage = (ev: MessageEvent<CommandInfoViewMessage>): void => {
    switch (ev.data.type) {
    case "commandChanged":
        loadCommand(ev.data.command);
        break;
    }
};

/**
 * Create all DOM elements for a command, including the command and module name,
 * a dropdown of parameter set names, and a form for each parameter set.
 */
function loadCommand(command: ICommand): void {
    welcomeMessage.hidden = true;
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
        form.hidden = !isDefault;
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

            // Create input text/checkbox field
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

            // Append common parameters to the <details> element
            if (commonParameterNames.includes(parameter.name)) {
                commonParametersContainer.appendChild(parameterDiv);
            } else {
                form.appendChild(parameterDiv);
            }
        }

        // Show common parameters <details> element
        if (commonParametersContainer.childElementCount > 0) {
            const summary = document.createElement("summary");
            summary.textContent = "Common Parameters";
            commonParametersContainer.appendChild(summary);
            form.appendChild(commonParametersContainer);
        }

        // Show a message if there are no parameters
        if (form.childElementCount === 0) {
            if (!command.moduleName) {
                form.innerHTML = "<p>There are no parameters.</p>";
            } else {
                // Commands appear to have no parameters if the module isn't imported.
                // TODO: Is there a way we can get the currently imported modules (without evaluating in the console)?
                const p = document.createElement("p");
                p.textContent = `There are no parameters. You may need to import the ${command.moduleName} module for the parameters to appear.`;

                const importBtn = document.createElement("button");
                importBtn.type = "button";
                importBtn.className = "button-primary";
                importBtn.style.width = "100%";
                importBtn.textContent = `Import ${command.moduleName}`;
                importBtn.onclick = ((): void => {
                    vscode.postMessage({ type: "importRequested", moduleName: command.moduleName });
                    importBtn.disabled = true;
                });

                form.append(p, importBtn);
            }
        }

        // If all forms are hidden (isDefault === false for all parameterSets), show the first form.
        if (forms.length > 0 && forms.find(f => !f.hidden) === undefined) {
            forms[0].hidden = false;
        }

        // Action buttons (run/insert/copy)
        const submitsDiv = document.createElement("div");
        submitsDiv.style.margin = "8px 0";
        submitsDiv.innerHTML = /*html*/ `
            <button type="submit" class="button-primary" name="__action" value="run">Run</button>
            <button type="submit" class="button-secondary" name="__action" value="insert">Insert</button>
            <button type="submit" class="button-secondary" name="__action" value="copy">Copy</button>
        `;
        form.appendChild(submitsDiv);
    }

    selectParameterSet.replaceChildren(...options);
    divParameterForms.replaceChildren(...forms);

    // Only show select box if there's more than one ParameterSet
    selectParameterSet.hidden = selectParameterSet.options.length <= 1;
}

/** Show the form for the ParameterSet when the dropdown selection changes */
function onParameterSetSelectionChanged(): void {
    const selectedOption = selectParameterSet.selectedOptions.item(0);
    const parameterSet = selectedOption?.value;
    const forms = divParameterForms.getElementsByTagName("form");
    for (let i = 0; i < forms.length; i++) {
        const form = forms.item(i)!;
        form.hidden = form.name !== parameterSet;
    }
}

/** Send a "submit" message when one of the action buttons are clicked */
function onFormSubmit(ev: SubmitEvent): void {
    ev.preventDefault();
    const form = ev.target as HTMLFormElement;
    const formData = new FormData(form, ev.submitter);

    // Collect all parameters with non-empty values
    const parameters: Record<string, string | null> = {};
    const inputs = form.getElementsByTagName("input");
    for (let i = 0; i < inputs.length; i++) {
        const input = inputs.item(i)!;
        if (input.type === "checkbox" && input.checked)
            parameters[input.name] = null; // Use null value for SwitchParameter
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
