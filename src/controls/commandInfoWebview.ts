// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
    CommandInfoViewModel,
    CommandInfoParameterInput,
    CommandInfoSetCommandViewArg,
} from "./commandInfoViewModel";

// Import styles so esbuild includes them in dist
import "./commandInfoWebview.css";

const welcomeMessage = document.getElementById("welcome-message")!;
const commandForm = document.getElementById("command-form") as HTMLFormElement;

const commandNameElement = document.getElementById("command-name")!;
const moduleNameElement = document.getElementById("module-name")!;
const selectParameterSet = document.getElementById("select-parameter-set") as HTMLSelectElement;

const noParametersMessage = document.getElementById("no-parameters-message")!;
const notImportedMessage = document.getElementById("not-imported-message")!;
const importModuleButton = document.getElementById("import-module-button") as HTMLButtonElement;

const standardParametersGroup = document.getElementById("standard-parameters-group")!;
const commonParametersGroup = document.getElementById("common-parameters-group")!;

const viewModel = new CommandInfoViewModel(
    acquireVsCodeApi(),
    { setCommandElements, setParameterInputs },
);

// Pass webview messages to viewModel
window.addEventListener("message", (m) => { viewModel.onMessage(m.data); });

// Notify viewModel when the selected parameter set changes
selectParameterSet.addEventListener("change", (ev) => {
    ev.stopPropagation();
    viewModel.onSelectedParameterSetChanged(selectParameterSet.value);
});

// Notify viewModel when an input value changes
commandForm.addEventListener("change", (ev) => {
    const input = ev.target as HTMLInputElement;
    const value = input.type === "checkbox" ? input.checked : input.value;
    viewModel.onParameterValueChanged(input.name, value);
});

// Notify viewModel when one of the submit actions are triggered
commandForm.addEventListener("submit", (ev) => {
    ev.stopPropagation();
    ev.preventDefault();

    const formData = new FormData(commandForm, ev.submitter);
    if (!formData.has("__action")) { return; }
    viewModel.onSubmit(formData.get("__action") as "run" | "insert" | "copy");
});

// Send import request when Import-Module is clicked
importModuleButton.addEventListener("click", () => {
    importModuleButton.disabled = true;
    viewModel.onImportModule();
});

/**
 * Set elements in the view that do not change between parameter sets,
 * including the parameter set dropdown, and the command and module names.
 */
function setCommandElements(arg: CommandInfoSetCommandViewArg): void {
    welcomeMessage.hidden = true;
    commandForm.hidden = false;
    commandNameElement.textContent = arg.commandName;
    moduleNameElement.textContent = arg.moduleName;

    selectParameterSet.innerHTML = "";
    const options = arg.parameterSets.map((name) => {
        const opt = document.createElement("option");
        opt.text = name;
        opt.value = name;
        opt.selected = name === arg.selectedParameterSet;
        return opt;
    });
    selectParameterSet.append(...options);

    notImportedMessage.hidden = arg.moduleLoaded;
    importModuleButton.textContent = `Import-Module ${arg.moduleName}`;
    importModuleButton.disabled = false;
}

/**
 * Create a div that contains a label and input for a parameter.
 */
function createParameterInput(parameterInput: CommandInfoParameterInput): void {
    const div = document.createElement("div");
    div.className = "parameter-input";
    div.title = parameterInput.tooltip;

    const input = document.createElement("input");
    input.id = `input-${parameterInput.name}`;
    input.name = parameterInput.name;
    input.type = parameterInput.inputType;
    if (parameterInput.inputType === "text") {
        input.value = parameterInput.value;
    } else {
        input.checked = parameterInput.value;
    }

    const label = document.createElement("label");
    label.textContent = parameterInput.name + (parameterInput.required ? "*" : "");
    label.htmlFor = input.id;

    div.append(label, input);

    const group = parameterInput.common ? commonParametersGroup : standardParametersGroup;
    group.appendChild(div);
}

/**
 * Remove all existing input fields in the view, and create new ones for the given parameters.
 */
function setParameterInputs(parameterInputs: CommandInfoParameterInput[]): void {
    standardParametersGroup.innerHTML = "";
    commonParametersGroup.innerHTML = "";

    parameterInputs.forEach(createParameterInput);
    noParametersMessage.hidden = parameterInputs.length > 0;
}
