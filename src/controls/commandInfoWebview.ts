// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { CommandInfoViewMessage, ICommand } from "../features/GetCommands";

let elementCommandName: HTMLElement;
let elementCommandModule: HTMLElement;
let selectParameterSet: HTMLSelectElement;
let divParameterForms: HTMLElement;

document.addEventListener("DOMContentLoaded", () => {
    elementCommandName = document.getElementById("commandName")!;
    elementCommandModule = document.getElementById("commandModule")!;
    selectParameterSet = document.getElementById("selectParameterSet") as HTMLSelectElement;
    divParameterForms = document.getElementById("parameterForms")!;

    selectParameterSet.onchange = parameterSetSelectionChanged;
});

window.onmessage = (ev: MessageEvent<CommandInfoViewMessage>): void => {
    switch (ev.data.type) {
    case "commandChanged":
        loadCommand(ev.data.command);
        break;
    }
};

function loadCommand(command: ICommand): void {
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

            const input = document.createElement("input");
            input.name = parameter.name;
            input.type = parameter.parameterType.startsWith("System.Management.Automation.SwitchParameter") ? "checkbox" : "text";
            input.id = `${parameterSet.name}-${parameter.name}`;

            const label = document.createElement("label");
            label.htmlFor = input.id;
            label.textContent = parameter.name + (parameter.isMandatory ? "*" : "");

            parameterDiv.append(label, input);
            form.appendChild(parameterDiv);
        }
    }

    selectParameterSet.replaceChildren(...options);
    divParameterForms.replaceChildren(...forms);

    // Only show select box if there's more than one ParameterSet
    selectParameterSet.hidden = selectParameterSet.options.length <= 1;
}

function parameterSetSelectionChanged(): void {
    const selectedOption = selectParameterSet.selectedOptions.item(0);
    const parameterSet = selectedOption?.value;
    const forms = divParameterForms.getElementsByTagName("form");
    for (let i = 0; i < forms.length; i++) {
        const form = forms.item(i)!;
        form.hidden = form.name !== parameterSet;
    }
}
