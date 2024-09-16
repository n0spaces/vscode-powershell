// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import type { CommandInfoViewMessage, CommandParameterInfo, ICommand } from "../features/GetCommands";

declare global {
    interface VsCodeWebviewApi<T = unknown> {
        postMessage(message: CommandInfoViewMessage): void;
        getState(): T | undefined;
        setState<T>(newState: T): T;
    }
    function acquireVsCodeApi<T = unknown>(): VsCodeWebviewApi<T>
}

export interface CommandInfoSetCommandViewArg {
    commandName: string;
    moduleName: string;
    parameterSets: string[];
    selectedParameterSet: string;
}

export type CommandInfoParameterInput = {
    name: string;
    required: boolean;
    common: boolean;
    tooltip: string;
} & (
    | { inputType: "text"; value: string }
    | { inputType: "checkbox"; value: boolean }
);

/**
 * View-side functions that set the DOM elements
 */
export interface CommandInfoViewFuncs {
    /**
     * View function that sets elements visible for all parameter sets,
     * including the parameter set dropdown and the command/module names.
     */
    setCommandElements: (arg: CommandInfoSetCommandViewArg) => void;

    /**
     * View function that replaces existing input elements with the ones given.
     */
    setParameterInputs: (inputs: CommandInfoParameterInput[]) => void;
}

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

function createParameterInputObject(parameter: CommandParameterInfo): CommandInfoParameterInput {
    const isSwitch = parameter.parameterType.startsWith("System.Management.Automation.SwitchParameter");
    const tooltip = `Type: ${parameter.parameterType.split(",")[0]}`
        + (parameter.position >= 0 ? `\nPosition: ${parameter.position}` : "")
        + (parameter.isMandatory ? "\nMandatory" : "\nOptional")
        + (parameter.valueFromPipeline ? "\nCan receive value from pipeline" : "");

    return {
        name: parameter.name,
        required: parameter.isMandatory,
        common: commonParameterNames.includes(parameter.name),
        tooltip: tooltip,
        ...isSwitch
            ? { inputType: "checkbox", value: false }
            : { inputType : "text", value : "" },
    };
}

/**
 * Class that handles the state of the Command Info webview
 * and communicates with the CommandInfoViewProvider.
 *
 * The webview API and DOM-related functions are dependency-injected
 * so we can write tests for this class without needing a webview.
 */
export class CommandInfoViewModel {
    command: ICommand | null = null;
    selectedParameterSet = "";

    /** Map of ParameterSet names to arrays of parameter input objects */
    parameterSetInputs: Record<string, CommandInfoParameterInput[]> = {};

    constructor(private vscodeApi: VsCodeWebviewApi, private view: CommandInfoViewFuncs) { }

    onMessage(ev: MessageEvent<CommandInfoViewMessage>): void {
        switch (ev.data.type) {
        case "commandChanged":
            this.onCommandChanged(ev.data.payload.command);
            return;
        }
    }

    onCommandChanged(command: ICommand): void {
        this.command = command;

        this.parameterSetInputs = {};
        for (const parameterSet of command.parameterSets) {
            this.parameterSetInputs[parameterSet.name] = parameterSet.parameters.map(createParameterInputObject);
        }

        // Set fallback if parameterSets is empty
        if (command.parameterSets.length === 0) {
            command.parameterSets.push({ name: "__AllParameterSets", isDefault: true, parameters: [] });
        }

        this.selectedParameterSet = command.defaultParameterSet;
        // Sometimes defaultParameterSet is unset.
        // If this happens, find the name of the first parameter set where isDefault is true,
        // or use the first set's name if there is no default parameter set.
        if (!this.selectedParameterSet) {
            this.selectedParameterSet = command.parameterSets.find((set) => set.isDefault)?.name
                ?? command.parameterSets[0].name;
        }

        this.view.setCommandElements({
            commandName: command.name,
            moduleName: command.moduleName,
            parameterSets: command.parameterSets.map((set) => set.name),
            selectedParameterSet: this.selectedParameterSet,
        });

        this.view.setParameterInputs(this.parameterSetInputs[this.selectedParameterSet]);
    }

    onSelectedParameterSetChanged(selected: string): void {
        if (this.selectedParameterSet === selected) { return; }
        this.selectedParameterSet = selected;
        this.view.setParameterInputs(this.parameterSetInputs[selected]);
    }

    onParameterValueChanged(name: string, value: string | boolean): void {
        const parameterInput = this.parameterSetInputs[this.selectedParameterSet].find((p) => p.name === name);
        if (parameterInput === undefined) {
            throw new Error(`Parameter ${name} not found in selected parameter set ${this.selectedParameterSet}`);
        }
        parameterInput.value = value;
        // TODO: should state be persisted through the webview api?
    }

    onSubmit(action: "run" | "insert" | "copy"): void {
        if (this.command === null) {
            throw new Error("this.command is null");
        }
        this.vscodeApi.postMessage({
            type: "submit",
            payload: {
                action: action,
                commandName: this.command.name,
                parameters: this.parameterSetInputs[this.selectedParameterSet]
                    .filter((parameterInput) => parameterInput.value)
                    .map((parameterInput) => [parameterInput.name, parameterInput.value]),
            }
        });
    }
}
