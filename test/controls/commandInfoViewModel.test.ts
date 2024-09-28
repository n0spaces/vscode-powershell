// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { CommandInfoViewMessage, ICommand } from "../../src/features/GetCommands";
import { CommandInfoParameterInput, CommandInfoViewModel, compareParameterInputObjects } from "../../src/controls/commandInfoViewModel";
import * as sinon from "sinon";
import * as assert from "assert";

/**
 * Example command from `examples/PathProcessingWildcards.ps1`,
 * which has common parameters and multiple parameter sets.
 */
const sampleCommand: Readonly<ICommand> = {
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
const sampleParameterSetInputs: Readonly<Record<string, readonly Readonly<CommandInfoParameterInput>[]>> = {
    Path: [
        {
            name: "Path",
            required: true,
            position: 0,
            common: false,
            tooltip: "Type: System.String[]\nPosition: 0\nMandatory\nCan receive value from pipeline",
            inputType: "text",
            value: "",
        },
        {
            name: "WhatIf",
            required: false,
            position: null,
            common: false,
            tooltip: "Type: System.Management.Automation.SwitchParameter\nOptional",
            inputType: "checkbox",
            value: false,
        },
        {
            name: "OutVariable",
            required: false,
            position: null,
            common: true,
            tooltip: "Type: System.String\nOptional",
            inputType: "text",
            value: "",
        },
        {
            name: "Verbose",
            required: false,
            position: null,
            common: true,
            tooltip: "Type: System.Management.Automation.SwitchParameter\nOptional",
            inputType: "checkbox",
            value: false,
        },
    ],
    LiteralPath: [
        {
            name: "LiteralPath",
            required: true,
            position: 0,
            common: false,
            tooltip: "Type: System.String[]\nPosition: 0\nMandatory",
            inputType: "text",
            value: "",
        },
        {
            name: "WhatIf",
            required: false,
            position: null,
            common: false,
            tooltip: "Type: System.Management.Automation.SwitchParameter\nOptional",
            inputType: "checkbox",
            value: false,
        },
        {
            name: "OutVariable",
            required: false,
            position: null,
            common: true,
            tooltip: "Type: System.String\nOptional",
            inputType: "text",
            value: "",
        },
        {
            name: "Verbose",
            required: false,
            position: null,
            common: true,
            tooltip: "Type: System.Management.Automation.SwitchParameter\nOptional",
            inputType: "checkbox",
            value: false,
        },
    ],
};

describe("CommandInfoViewModel", function() {
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
            moduleLoaded: true,
            parameterSets: ["Path", "LiteralPath"],
            selectedParameterSet: "Path",
        });
    });

    it("Should set moduleLoaded false if command has module and no parameters", function() {
        const vm = new CommandInfoViewModel(fakeWebviewApi, fakeView);
        vm.onCommandChanged({
            name: "Invoke-Sample",
            moduleName: "SampleModule",
            parameters: {},
            parameterSets: [],
            defaultParameterSet: "",
        });
        sinon.assert.calledWithMatch(fakeView.setCommandElements, { moduleLoaded: false });
    });

    it("Should set moduleLoaded true if command has no module", function() {
        const vm = new CommandInfoViewModel(fakeWebviewApi, fakeView);
        vm.onCommandChanged({
            name: "Invoke-Sample",
            moduleName: "",
            parameters: {},
            parameterSets: [],
            defaultParameterSet: "",
        });
        sinon.assert.calledWithMatch(fakeView.setCommandElements, { moduleLoaded: true });
    });

    it("Should call setParameterInputs with default parameter set on commandChanged", function() {
        const vm = new CommandInfoViewModel(fakeWebviewApi, fakeView);
        vm.onMessage({ type: "commandChanged", payload: { command: sampleCommand } });
        sinon.assert.calledWithMatch(
            fakeView.setParameterInputs,
            sinon.match.array.deepEquals([...sampleParameterSetInputs.Path]), // Path parameter set only
        );
    });

    it("Should add __AllParameterSets if there are no parameterSets", function() {
        const vm = new CommandInfoViewModel(fakeWebviewApi, fakeView);
        const emptyCommand: ICommand = {
            name: "Invoke-SampleCommand",
            moduleName: "SampleModule",
            parameters: {/*...*/},
            parameterSets: [],
            defaultParameterSet: "",
        };
        vm.onCommandChanged(emptyCommand);
        assert.strictEqual(vm.selectedParameterSet, "__AllParameterSets");
        assert.deepStrictEqual(vm.parameterSetInputs, { __AllParameterSets: [] });
    });

    it("Should set selectedParameterSet even if there is no default", function() {
        const vm = new CommandInfoViewModel(fakeWebviewApi, fakeView);

        // Command where defaultParameterSet is empty, but the Bar parameterSet has isDefault set to true.
        // selectedParameterSet should be Bar.
        const commandDefaultParameterSetEmpty: ICommand = {
            name: "Invoke-SampleCommand",
            moduleName: "SampleModule",
            parameters: {/*...*/},
            parameterSets: [
                { name: "Foo", isDefault: false, parameters: [] },
                { name: "Bar", isDefault: true, parameters: [] },
            ],
            defaultParameterSet: "",
        };
        vm.onCommandChanged(commandDefaultParameterSetEmpty);
        assert.strictEqual(vm.selectedParameterSet, "Bar");

        // Command where there is no default parameterSet.
        // selectedParameterSet should be the first one.
        const commandWithoutDefaultParameterSet = {
            ...commandDefaultParameterSetEmpty,
            parameterSets: [
                { name: "Foo", isDefault: false, parameters: [] },
                { name: "Bar", isDefault: false, parameters: [] },
            ],
        };
        vm.onCommandChanged(commandWithoutDefaultParameterSet);
        assert.strictEqual(vm.selectedParameterSet, "Foo");
    });

    it("Should call setParameterInputs on onSelectedParameterSetChanged", function() {
        const vm = new CommandInfoViewModel(fakeWebviewApi, fakeView);
        vm.onMessage({ type: "commandChanged", payload: { command: sampleCommand } });
        fakeView.setParameterInputs.resetHistory();

        vm.onSelectedParameterSetChanged("LiteralPath");
        assert.strictEqual(vm.selectedParameterSet, "LiteralPath");
        sinon.assert.calledWithMatch(
            fakeView.setParameterInputs,
            sinon.match.array.deepEquals([...sampleParameterSetInputs.LiteralPath]),
        );

        vm.onSelectedParameterSetChanged("Path");
        assert.strictEqual(vm.selectedParameterSet, "Path");
        sinon.assert.calledWithMatch(
            fakeView.setParameterInputs,
            sinon.match.array.deepEquals([...sampleParameterSetInputs.Path]),
        );
    });

    it("Should update values for selected parameterSet on onParameterValueChanged", function() {
        const expectedParameterSetInputs = {
            Path: [...sampleParameterSetInputs.Path],
            LiteralPath: [...sampleParameterSetInputs.LiteralPath]
        };

        const vm = new CommandInfoViewModel(fakeWebviewApi, fakeView);
        vm.onMessage({ type: "commandChanged", payload: { command: sampleCommand } });

        vm.onParameterValueChanged("Path", "foo.txt");
        expectedParameterSetInputs.Path[0] = {
            name: "Path",
            required: true,
            position: 0,
            common: false,
            tooltip: "Type: System.String[]\nPosition: 0\nMandatory\nCan receive value from pipeline",
            inputType: "text",
            value: "foo.txt",
        };
        assert.deepStrictEqual(vm.parameterSetInputs, expectedParameterSetInputs);

        vm.onParameterValueChanged("Verbose", true);
        expectedParameterSetInputs.Path[3] = {
            name: "Verbose",
            required: false,
            position: null,
            common: true,
            tooltip: "Type: System.Management.Automation.SwitchParameter\nOptional",
            inputType: "checkbox",
            value: true,
        };
        assert.deepStrictEqual(vm.parameterSetInputs, expectedParameterSetInputs);

        vm.onSelectedParameterSetChanged("LiteralPath");
        vm.onParameterValueChanged("LiteralPath", "bar.txt");
        expectedParameterSetInputs.LiteralPath[0] = {
            name: "LiteralPath",
            required: true,
            position: 0,
            common: false,
            tooltip: "Type: System.String[]\nPosition: 0\nMandatory",
            inputType: "text",
            value: "bar.txt",
        };
        assert.deepStrictEqual(vm.parameterSetInputs, expectedParameterSetInputs);

        vm.onParameterValueChanged("WhatIf", true);
        expectedParameterSetInputs.LiteralPath[1] = {
            name: "WhatIf",
            required: false,
            position: null,
            common: false,
            tooltip: "Type: System.Management.Automation.SwitchParameter\nOptional",
            inputType: "checkbox",
            value: true,
        };
        assert.deepStrictEqual(vm.parameterSetInputs, expectedParameterSetInputs);
    });

    it("Should submit selected parameterSet values on onSubmit", function() {
        const vm = new CommandInfoViewModel(fakeWebviewApi, fakeView);
        vm.onCommandChanged(sampleCommand);

        // Set Path and check Verbose
        vm.onParameterValueChanged("Path", "foo.txt");
        vm.onParameterValueChanged("Verbose", true);
        vm.onSubmit("run");

        const expectedRunMessage: CommandInfoViewMessage = {
            type: "submit",
            payload: {
                action: "run",
                commandName: "Import-FileWildcard",
                parameters: [ ["Path", "foo.txt"], ["Verbose", true] ],
            },
        };
        sinon.assert.calledWith(fakeWebviewApi.postMessage, expectedRunMessage);

        // Set Path again and uncheck Verbose
        vm.onParameterValueChanged("Path", "bar.txt");
        vm.onParameterValueChanged("Verbose", false);
        vm.onSubmit("insert");

        const expectedInsertMessage: CommandInfoViewMessage = {
            type: "submit",
            payload: {
                action: "insert",
                commandName: "Import-FileWildcard",
                // Should not include Verbose because it was unchecked
                parameters: [ ["Path", "bar.txt"] ],
            },
        };
        sinon.assert.calledWithMatch(fakeWebviewApi.postMessage, expectedInsertMessage);

        // Change parameterSet then set LiteralPath, OutVariable and check WhatIf
        vm.onSelectedParameterSetChanged("LiteralPath");
        vm.onParameterValueChanged("LiteralPath", "baz.txt");
        vm.onParameterValueChanged("OutVariable", "myvar");
        vm.onParameterValueChanged("WhatIf", true);
        vm.onSubmit("copy");

        const expectedCopyMessage: CommandInfoViewMessage = {
            type: "submit",
            payload: {
                action: "copy",
                commandName: "Import-FileWildcard",
                parameters: [
                    ["LiteralPath", "baz.txt"],
                    ["WhatIf", true],
                    ["OutVariable", "myvar"],
                ],
            },
        };
        sinon.assert.calledWith(fakeWebviewApi.postMessage, expectedCopyMessage);
    });

    it("Sorts parameters correctly", function() {
        const parameters = [
            { name: "aaa", position: null, common: true },
            { name: "yyy", position: null, common: false },
            { name: "bbb", position: null, common: false },
            { name: "xxx", position: 1, common: false },
            { name: "ccc", position: null, common: true },
            { name: "zzz", position: 0, common: false },
        ];
        // @ts-expect-error missing unused props
        parameters.sort(compareParameterInputObjects);

        // Should sort by position, then uncommon by name, then common by name
        const expected = [
            { name: "zzz", position: 0, common: false },
            { name: "xxx", position: 1, common: false },
            { name: "bbb", position: null, common: false },
            { name: "yyy", position: null, common: false },
            { name: "aaa", position: null, common: true },
            { name: "ccc", position: null, common: true },
        ];
        assert.deepStrictEqual(parameters, expected);
    });

    it("Should send setState message on parameter value change", function() {
        const vm = new CommandInfoViewModel(fakeWebviewApi, fakeView);
        vm.onCommandChanged(sampleCommand);
        // Ignore getState message
        fakeWebviewApi.postMessage.resetHistory();

        const expectedState = {
            command: sampleCommand,
            parameterSetInputs: {
                Path: [
                    { ...sampleParameterSetInputs.Path[0], value: "foo" },
                    ...sampleParameterSetInputs.Path.slice(1),
                ],
                LiteralPath: [...sampleParameterSetInputs.LiteralPath],
            },
            selectedParameterSet: "Path",
        };

        vm.onParameterValueChanged("Path", "foo");

        sinon.assert.calledWith(fakeWebviewApi.postMessage, {
            type: "setState",
            payload: { newState: expectedState },
        });

        vm.onSelectedParameterSetChanged("LiteralPath");
        expectedState.selectedParameterSet = "LiteralPath";
        sinon.assert.calledWith(fakeWebviewApi.postMessage, {
            type: "setState",
            payload: { newState: expectedState },
        });

        // vm should NOT call setState in the webview api
        sinon.assert.notCalled(fakeWebviewApi.setState);
    });
});
