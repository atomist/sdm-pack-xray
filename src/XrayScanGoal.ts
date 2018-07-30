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

import { logger } from "@atomist/automation-client";
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
import axios from "axios";

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

interface XrayServerDetails {
    baseUrl: string;
    credential: string | { username: string, password: string };
}

interface BuildDetails {
    artifactoryId: string;
    buildNumber: string;
    buildName: string;
}

/**
 * Synchronously run an xray scan
 * @param xray server details
 * @param build build details
 */
export function scanBuild(xray: XrayServerDetails, build: BuildDetails): Promise<any> {
    let url = `${xray.credential}/scanBuild`;
    const config = {
        auth: undefined,
        headers: {
            "Content-Type": "application/json",
        },
    };

    if (typeof xray.credential === "string") {
        url = `${xray.credential}/scanBuild?token=${xray.credential}`;
    } else {
        config.auth = {
            username: xray.credential.username,
            password: xray.credential.password,
        };
    }

    logger.info("Scanning build %j on %S", build, xray.baseUrl);

    return axios.post(
        url,
        build,
        config);
}
