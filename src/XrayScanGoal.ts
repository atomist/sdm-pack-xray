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

import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import { spawnAndWatch } from "@atomist/automation-client/util/spawned";
import {
    ExecuteGoalResult,
    ExecuteGoalWithLog,
    Goal,
    GoalInvocation,
    IndependentOfEnvironment,
    RunWithLogContext,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import { readSdmVersion } from "@atomist/sdm-core";

export const XrayScan = new Goal({
    uniqueName: "XrayScan",
    environment: IndependentOfEnvironment,
    orderedName: "1-xray-scan",
    displayName: "Xray Scan",
    workingDescription: "Scanning dependencies...",
    completedDescription: "Dependencies scanned",
    failedDescription: "Dependency scan failed",
    retryFeasible: true,
});

export async function rwlcVersion(gi: GoalInvocation): Promise<string> {
    const sdmGoal = gi.sdmGoal;
    const version = await readSdmVersion(
        sdmGoal.repo.owner,
        sdmGoal.repo.name,
        sdmGoal.repo.providerId,
        sdmGoal.sha,
        sdmGoal.branch,
        gi.context);
    return version;
}

export function xrayScanner(sdm: SoftwareDeliveryMachine): ExecuteGoalWithLog {
    return async (rwlc: RunWithLogContext): Promise<ExecuteGoalResult> => {
        const { credentials, id, context } = rwlc;
        const version = await rwlcVersion(rwlc);

        return null;
    };
}
