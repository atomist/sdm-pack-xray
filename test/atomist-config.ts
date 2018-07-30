/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Configuration } from "@atomist/automation-client";
import {
    AnyPush,
    Goal,
    Goals,
    goals,
    IndependentOfEnvironment,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import {
    configureSdm,
    createSoftwareDeliveryMachine,
} from "@atomist/sdm-core";

import { Project } from "@atomist/automation-client/project/Project";
import * as build from "@atomist/sdm/api-helper/dsl/buildDsl";
import { SoftwareDeliveryMachineConfiguration } from "@atomist/sdm/api/machine/SoftwareDeliveryMachineOptions";
import { XraySupport } from "../src/xray";
import { XrayScan } from "../src/XrayScanGoal";

export const BuildWithJenkins = new Goal({
    uniqueName: "BuildWithJenkins",
    environment: IndependentOfEnvironment,
    orderedName: "1-build-with-jenkins",
    displayName: "build with jenkins",
    workingDescription: "build started",
    completedDescription: "build success",
    failedDescription: "build failed",
});

export const TestGoals: Goals = goals("Test")
    .plan(XrayScan).after(BuildWithJenkins);

export function machineMaker(config: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {

    const sdm = createSoftwareDeliveryMachine({
        name: `${configuration.name}-test`,
        configuration: config,
    });

    sdm.addKnownSideEffect(
        BuildWithJenkins,
        "buildWithJenkins",
        AnyPush,
    );

    // put in other things you need for your test
    sdm.addExtensionPacks(XraySupport);

    return sdm;

}

export const configuration: Configuration = {
    postProcessors: [
        configureSdm(machineMaker),
    ],
};
