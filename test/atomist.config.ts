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
    BuildGoal,
    Goals,
    goals,
    SoftwareDeliveryMachine,
    whenPushSatisfies,
} from "@atomist/sdm";
import {
    configureSdm,
    createSoftwareDeliveryMachine,
} from "@atomist/sdm-core";

import { SoftwareDeliveryMachineConfiguration } from "@atomist/sdm/api/machine/SoftwareDeliveryMachineOptions";
import { XraySupport } from "../lib/xray";
import { XrayScan } from "../lib/XrayScanGoal";

export const TestGoals: Goals = goals("Test")
    .plan(BuildGoal)
    .plan(XrayScan).after(BuildGoal);

export function machineMaker(config: SoftwareDeliveryMachineConfiguration): SoftwareDeliveryMachine {

    const sdm = createSoftwareDeliveryMachine(
        {
            name: `${configuration.name}-test`,
            configuration: config,
        },
        whenPushSatisfies(AnyPush).itMeans("Always run").setGoals(TestGoals));

    sdm.addKnownSideEffect(
        BuildGoal,
        "buildWithJenkins",
        AnyPush,
    );

    sdm.addExtensionPacks(XraySupport);

    return sdm;

}

export const configuration: Configuration = {
    postProcessors: [
        configureSdm(machineMaker),
    ],
};
