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

export interface CommandInfoViewState {
    command: ICommand | null;
    selectedParameterSet: string;
    parameterSetInputs: Record<string, CommandInfoParameterInput[]>;
}

export interface CommandInfoSetCommandViewArg {
    commandName: string;
    moduleName: string;
    moduleLoaded: boolean;
    parameterSets: string[];
    selectedParameterSet: string;
}

export type CommandInfoParameterInput = {
    name: string;
    required: boolean;
    common: boolean;
    tooltip: string;
    position: number | null;
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

    /** View function that replaces existing input elements with the ones given. */
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
        position: parameter.position >= 0 ? parameter.position : null,
        ...isSwitch
            ? { inputType: "checkbox", value: false }
            : { inputType : "text", value : "" },
    };
}

/**
 * Comparer that sorts parameters by increasing position, then non-common parameters by name,
 * then common parameters by name.
 */
export function compareParameterInputObjects(a: CommandInfoParameterInput, b: CommandInfoParameterInput): number {
    if (a.common !== b.common) {
        return b.common ? -1 : 1;
    }
    if (a.position !== null && b.position !== null) {
        return a.position - b.position;
    }
    if (a.position === null && b.position === null) {
        return a.name.localeCompare(b.name);
    }
    return a.position !== null ? -1 : 1;
}

/**
 * Class that handles the state of the Command Info webview
 * and communicates with the CommandInfoViewProvider.
 *
 * The webview API and DOM-related functions are dependency-injected
 * so we can write tests for this class without needing a webview.
 */
export class CommandInfoViewModel implements CommandInfoViewState {
    command: Readonly<ICommand> | null = null;
    selectedParameterSet = "";

    /** Map of ParameterSet names to arrays of parameter input objects */
    parameterSetInputs: Record<string, CommandInfoParameterInput[]> = {};

    constructor(
        private vscodeApi: VsCodeWebviewApi<CommandInfoViewMessage>,
        private view: CommandInfoViewFuncs
    ) { }

    /**
     * Set command-level elements in the view (command/module name, parameter set options, etc.)
     */
    viewSetCommandElements(): void {
        if (this.command === null) {
            throw new Error("this.command is null");
        }

        // If there are no parameters, it's possible the module isn't loaded.
        // I don't think there's a way to get all the loaded modules in PSES without evaluating a command in the console,
        // so for now we will display a message that the module _may_ need to be imported.
        const hasParameters = Object.values(this.parameterSetInputs).flat().length > 0;
        const moduleLoaded = !this.command.moduleName || hasParameters;

        this.view.setCommandElements({
            commandName: this.command.name,
            moduleName: this.command.moduleName,
            moduleLoaded: moduleLoaded,
            parameterSets: this.command.parameterSets.map((set) => set.name),
            selectedParameterSet: this.selectedParameterSet,
        });
    }

    /**
     * Set parameter elements in the view for the selected parameter set.
     */
    viewSetParameterInputs(): void {
        this.view.setParameterInputs(this.parameterSetInputs[this.selectedParameterSet]);
    }

    /**
     * Persist state in the webview provider, so values aren't lost if the webview is temporarily closed.
     */
    persistState(): void {
        this.vscodeApi.postMessage({
            type: "setState",
            payload: {
                newState: {
                    command: this.command,
                    parameterSetInputs: this.parameterSetInputs,
                    selectedParameterSet: this.selectedParameterSet,
                },
            },
        });
    }

    /**
     * Handle message sent by the webview provider.
     */
    onMessage(data: CommandInfoViewMessage): void {
        switch (data.type) {
        case "commandChanged":
            this.onCommandChanged(data.payload.command);
            return;
        case "setState":
            this.onSetState(data.payload.newState);
            return;
        }
    }

    /**
     * Update the current state to the value given by the webview provider.
     */
    onSetState(state: CommandInfoViewState): void {
        this.command = state.command;
        this.parameterSetInputs = state.parameterSetInputs;
        this.selectedParameterSet = state.selectedParameterSet;
        this.viewSetCommandElements();
        this.viewSetParameterInputs();
    }

    /**
     * Generate state for the selected command given by the webview provider.
     */
    onCommandChanged(command: ICommand): void {
        // Skip if the given command is exactly the same as the current one.
        // This may happen if the view provider tries to send us a command
        // after we already received it from the presisted state.
        if (JSON.stringify(command) === JSON.stringify(this.command)) {
            return;
        }

        this.command = command;

        // Set fallback if parameterSets is empty
        if (command.parameterSets.length === 0) {
            command.parameterSets.push({ name: "__AllParameterSets", isDefault: true, parameters: [] });
        }

        this.parameterSetInputs = {};
        for (const parameterSet of command.parameterSets) {
            this.parameterSetInputs[parameterSet.name] = parameterSet.parameters
                .map(createParameterInputObject)
                .sort(compareParameterInputObjects);
        }

        // Sometimes defaultParameterSet is null or empty.
        // If this happens, find the name of the first parameter set where isDefault is true,
        // or use the first parameter set if there is no default.
        this.selectedParameterSet = command.defaultParameterSet ||
            (command.parameterSets.find((set) => set.isDefault)?.name ?? command.parameterSets[0].name);

        this.viewSetCommandElements();
        this.viewSetParameterInputs();
    }

    /**
     * Called when the selection changes in the parameter set dropdown.
     */
    onSelectedParameterSetChanged(selected: string): void {
        if (this.selectedParameterSet === selected) { return; }
        this.selectedParameterSet = selected;
        this.viewSetParameterInputs();
        this.persistState();
    }

    /**
     * Called when the value changes in a parameter input field.
     */
    onParameterValueChanged(name: string, value: string | boolean): void {
        const parameterInput = this.parameterSetInputs[this.selectedParameterSet].find((p) => p.name === name);
        if (parameterInput === undefined) {
            throw new Error(`Parameter ${name} not found in selected parameter set ${this.selectedParameterSet}`);
        }
        parameterInput.value = value;
        this.persistState();
    }

    /**
     * Called when the import module button is clicked.
     */
    onImportModule(): void {
        if (this.command === null) {
            throw new Error("this.command is null");
        }
        this.vscodeApi.postMessage({
            type: "import",
            payload: { moduleName: this.command.moduleName },
        });
    }

    /**
     * Called when one of the submit actions are clicked.
     */
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
