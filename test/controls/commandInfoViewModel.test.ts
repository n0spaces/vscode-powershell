// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { ICommand } from "../../src/features/GetCommands";
import { CommandInfoViewModel } from "../../src/controls/commandInfoViewModel";
import * as sinon from "sinon";
import * as assert from "assert";

/**
 * Example command from `examples/PathProcessingWildcards.ps1`,
 * which has common parameters and multiple parameter sets.
 */
const sampleCommand: ICommand = {
    name: "Import-FileWildcard",
    moduleName: "SampleModule",
    parameters: {/*...*/},
    parameterSets: [
        {
            name: "Path",
            isDefault: true,
            parameters: [
                {
                    name: "Path",
                    parameterType: "System.String[], System.Private.CoreLib, Version=8.0.0.0, Culture=neutral, PublicKeyToken=7cec85d7bea7798e",
                    isMandatory: true,
                    isDynamic: false,
                    position: 0,
                    valueFromPipeline: true,
                    valueFromPipelineByPropertyName: true,
                    valueFromRemainingArguments: false,
                    helpMessage: "Path to one or more locations.",
                    aliases: [],
                    attributes: [/*...*/]
                },
                {
                    name: "Verbose",
                    parameterType: "System.Management.Automation.SwitchParameter, System.Management.Automation, Version=7.4.5.500, Culture=neutral, PublicKeyToken=31bf3856ad364e35",
                    isMandatory: false,
                    isDynamic: false,
                    position: -2147483648,
                    valueFromPipeline: false,
                    valueFromPipelineByPropertyName: false,
                    valueFromRemainingArguments: false,
                    helpMessage: null,
                    aliases: ["vb"],
                    attributes: [/*...*/],
                },
                {
                    name: "OutVariable",
                    parameterType: "System.String, System.Private.CoreLib, Version=8.0.0.0, Culture=neutral, PublicKeyToken=7cec85d7bea7798e",
                    isMandatory: false,
                    isDynamic: false,
                    position: -2147483648,
                    valueFromPipeline: false,
                    valueFromPipelineByPropertyName: false,
                    valueFromRemainingArguments: false,
                    helpMessage: null,
                    aliases: ["ov"],
                    attributes: [/*...*/],
                },
                {
                    name: "WhatIf",
                    parameterType: "System.Management.Automation.SwitchParameter, System.Management.Automation, Version=7.4.5.500, Culture=neutral, PublicKeyToken=31bf3856ad364e35",
                    isMandatory: false,
                    isDynamic: false,
                    position: -2147483648,
                    valueFromPipeline: false,
                    valueFromPipelineByPropertyName: false,
                    valueFromRemainingArguments: false,
                    helpMessage: null,
                    aliases: ["wi"],
                    attributes: [/*...*/],
                },
            ],
        },
        {
            name: "LiteralPath",
            isDefault: false,
            parameters: [
                {
                    name: "LiteralPath",
                    parameterType: "System.String[], System.Private.CoreLib, Version=8.0.0.0, Culture=neutral, PublicKeyToken=7cec85d7bea7798e",
                    isMandatory: true,
                    isDynamic: false,
                    position: 0,
                    valueFromPipeline: false,
                    valueFromPipelineByPropertyName: true,
                    valueFromRemainingArguments: false,
                    helpMessage: "Literal path to one or more locations.",
                    aliases: ["PSPath"],
                    attributes: [/*...*/],
                },
                {
                    name: "Verbose",
                    parameterType: "System.Management.Automation.SwitchParameter, System.Management.Automation, Version=7.4.5.500, Culture=neutral, PublicKeyToken=31bf3856ad364e35",
                    isMandatory: false,
                    isDynamic: false,
                    position: -2147483648,
                    valueFromPipeline: false,
                    valueFromPipelineByPropertyName: false,
                    valueFromRemainingArguments: false,
                    helpMessage: null,
                    aliases: ["vb"],
                    attributes: [/*...*/],
                },
                {
                    name: "OutVariable",
                    parameterType: "System.String, System.Private.CoreLib, Version=8.0.0.0, Culture=neutral, PublicKeyToken=7cec85d7bea7798e",
                    isMandatory: false,
                    isDynamic: false,
                    position: -2147483648,
                    valueFromPipeline: false,
                    valueFromPipelineByPropertyName: false,
                    valueFromRemainingArguments: false,
                    helpMessage: null,
                    aliases: ["ov"],
                    attributes: [/*...*/],
                },
                {
                    name: "WhatIf",
                    parameterType: "System.Management.Automation.SwitchParameter, System.Management.Automation, Version=7.4.5.500, Culture=neutral, PublicKeyToken=31bf3856ad364e35",
                    isMandatory: false,
                    isDynamic: false,
                    position: -2147483648,
                    valueFromPipeline: false,
                    valueFromPipelineByPropertyName: false,
                    valueFromRemainingArguments: false,
                    helpMessage: null,
                    aliases: ["wi"],
                    attributes: [/*...*/],
                },
            ],
        },
    ],
    defaultParameterSet: "Path",
};

/**
 * Expected `parameterSetInputs` value in the view-model
 * when using `sampleCommand` above.
 */
const sampleParameterSetInputs = {
    Path: [
        {
            name: "Path",
            required: true,
            common: false,
            tooltip: "Type: System.String[]\nPosition: 0\nMandatory\nCan receive value from pipeline",
            inputType: "text",
            value: "",
        },
        {
            name: "Verbose",
            required: false,
            common: true,
            tooltip: "Type: System.Management.Automation.SwitchParameter\nOptional",
            inputType: "checkbox",
            value: false,
        },
        {
            name: "OutVariable",
            required: false,
            common: true,
            tooltip: "Type: System.String\nOptional",
            inputType: "text",
            value: "",
        },
        {
            name: "WhatIf",
            required: false,
            common: false,
            tooltip: "Type: System.Management.Automation.SwitchParameter\nOptional",
            inputType: "checkbox",
            value: false,
        },
    ],
    LiteralPath: [
        {
            name: "LiteralPath",
            required: true,
            common: false,
            tooltip: "Type: System.String[]\nPosition: 0\nMandatory",
            inputType: "text",
            value: "",
        },
        {
            name: "Verbose",
            required: false,
            common: true,
            tooltip: "Type: System.Management.Automation.SwitchParameter\nOptional",
            inputType: "checkbox",
            value: false,
        },
        {
            name: "OutVariable",
            required: false,
            common: true,
            tooltip: "Type: System.String\nOptional",
            inputType: "text",
            value: "",
        },
        {
            name: "WhatIf",
            required: false,
            common: false,
            tooltip: "Type: System.Management.Automation.SwitchParameter\nOptional",
            inputType: "checkbox",
            value: false,
        },
    ],
};

describe("Command Info view-model", function() {
    const fakeView = {
        setCommandElements: sinon.fake(),
        setParameterInputs: sinon.fake(),
    };
    const fakeWebviewApi = {
        postMessage: sinon.fake(),
        getState: sinon.fake(),
        setState: sinon.fake(),
    };

    beforeEach(function() {
        fakeView.setCommandElements.resetHistory();
        fakeView.setParameterInputs.resetHistory();
        fakeWebviewApi.postMessage.resetHistory();
    });

    it("Should start with no command", function() {
        const vm = new CommandInfoViewModel(fakeWebviewApi, fakeView);
        assert.strictEqual(vm.command, null);
    });

    it("Should update entire state on commandChanged", function() {
        const vm = new CommandInfoViewModel(fakeWebviewApi, fakeView);
        vm.onMessage({ type: "commandChanged", payload: { command: sampleCommand } });
        assert.deepStrictEqual(vm.command, sampleCommand);
        assert.deepStrictEqual(vm.parameterSetInputs, sampleParameterSetInputs);
        assert.strictEqual(vm.selectedParameterSet, "Path");
    });

    it("Should call setCommandElements on commandChanged", function() {
        const vm = new CommandInfoViewModel(fakeWebviewApi, fakeView);
        vm.onMessage({ type: "commandChanged", payload: { command: sampleCommand } });
        sinon.assert.calledWith(fakeView.setCommandElements, {
            commandName: "Import-FileWildcard",
            moduleName: "SampleModule",
            parameterSets: ["Path", "LiteralPath"],
            selectedParameterSet: "Path",
        });
    });

    it("Should call setParameterInputs with default parameter set on commandChanged", function() {
        const vm = new CommandInfoViewModel(fakeWebviewApi, fakeView);
        vm.onMessage({ type: "commandChanged", payload: { command: sampleCommand } });
        sinon.assert.calledWithMatch(
            fakeView.setParameterInputs,
            sinon.match.array.deepEquals(sampleParameterSetInputs.Path), // Path parameter set only
        );
    });
});
