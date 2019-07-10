/*
 * Copyright © 2019 Atomist, Inc.
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

import {
    FailurePromise,
    HandlerContext,
    logger,
    SuccessPromise,
} from "@atomist/automation-client";
import {
    ExecuteGoal,
    ExecuteGoalResult,
    Goal,
    GoalInvocation,
    IndependentOfEnvironment,
    SoftwareDeliveryMachine,
} from "@atomist/sdm";
import { readSdmVersion } from "@atomist/sdm-core";
// tslint:disable-next-line:import-blacklist
import axios from "axios";
import * as types from "./typings/types";

export const XrayScan = new Goal({
    uniqueName: "XrayScan",
    environment: IndependentOfEnvironment,
    orderedName: "1-xray-scan",
    displayName: "Xray Scan",
    workingDescription: "Scanning dependencies...",
    completedDescription: "Dependencies scanned",
    failedDescription: "Xray scan failed",
    retryFeasible: true,
});

export async function rwlcVersion(gi: GoalInvocation): Promise<string> {
    const sdmGoal = gi.goalEvent;
    const version = await readSdmVersion(
        sdmGoal.repo.owner,
        sdmGoal.repo.name,
        sdmGoal.repo.providerId,
        sdmGoal.sha,
        sdmGoal.branch,
        gi.context);
    return version;
}

export function xrayScanner(sdm: SoftwareDeliveryMachine): ExecuteGoal {
    return async (r: GoalInvocation): Promise<ExecuteGoalResult> => {
        const { id, context, progressLog } = r;
        progressLog.write("looking for builds");
        const builds = await getCommitBuilds(context, id.sha, id.branch);
        // const version = await rwlcVersion(rwlc);

        if (!builds.Commit || builds.Commit.length < 1) {
            progressLog.write("commit not found");
            return FailurePromise;
        }
        const commit = builds.Commit[0];
        if (!commit.builds || commit.builds.length < 1) {
            progressLog.write("no builds found");
            return FailurePromise;
        }
        const build = commit.builds[0];
        const bits = build.buildId.split(":");
        const buildName = bits[2];
        const buildNumber = bits[3];

        progressLog.write(`scanning ${buildName}/${buildNumber}`);
        const scan = await scanBuild(
            {
                baseUrl: sdm.configuration.sdm.xray.baseUrl,
                credential: {
                    username: sdm.configuration.sdm.xray.username,
                    password: sdm.configuration.sdm.xray.password,
                },
            }, {
                artifactoryId: sdm.configuration.sdm.xray.artifactoryServerId,
                buildName,
                buildNumber,
            });
        logger.info(`Got some results ${scan.length} ${JSON.stringify(scan)}`);
        return SuccessPromise;
    };
}

async function getCommitBuilds(
    ctx: HandlerContext,
    sha: string,
    branch: string): Promise<types.FindBuildsForCommit.Query> {
    const buildsForCommit = await ctx.graphClient
        .query<types.FindBuildsForCommit.Query, types.FindBuildsForCommit.Variables>(
            {
                name: "findBuildsForCommit",
                variables:
                    { sha, branch: `^.*${branch}$` },
            });
    logger.info("Got graphql response %j", buildsForCommit);
    return buildsForCommit;
}

export interface XrayServerDetails {
    baseUrl: string;
    credential: string | { username: string, password: string };
}

export interface BuildDetails {
    artifactoryId: string;
    buildNumber: string;
    buildName: string;
}

/**
 * Synchronously run an xray scan
 * @param xray server details
 * @param build build details
 */
export async function scanBuild(
    xray: XrayServerDetails,
    build: BuildDetails): Promise<types.XrayViolations.XrayViolation[]> {
    let url = `${xray.baseUrl}/scanBuild`;
    const config: any = {
        headers: {
            "Content-Type": "application/json",
        },
    };

    if (typeof xray.credential === "string") {
        url = `${url}?token=${xray.credential}`;
    } else {
        config.auth = {
            username: xray.credential.username,
            password: xray.credential.password,
        };
    }

    logger.info("Scanning build %j on %S", build, xray.baseUrl);

    const result = await axios.post(url, build, config);
    return result.data.alerts;
}
