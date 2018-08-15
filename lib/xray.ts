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

import {
    ExtensionPack,
} from "@atomist/sdm";
import { LogSuppressor } from "@atomist/sdm/api-helper/log/logInterpreters";
import { metadata } from "@atomist/sdm/api-helper/misc/extensionPack";
import {
    BlockArtifactoryDownload,
    IgnoreViolationForProject,
    UnblockArtifactoryDownload,
    UnIgnoreViolationForProject,
} from "./handler/command/BlockDownloads";
import { CreateNewXrayIssue } from "./handler/command/CreateNewIssue";
import { XrayScan, xrayScanner } from "./XrayScanGoal";

export const XraySupport: ExtensionPack = {
    ...metadata(),
    requiredConfigurationValues: [
        "sdm.xray.baseUrl",
        "sdm.xray.artifactoryServerId",
        "sdm.xray.username",
        "sdm.xray.password",
        "sdm.xray.artifactory.baseUrl",
        "sdm.xray.artifactory.token",
    ],
    configure: sdm => {
        sdm.addCommand(BlockArtifactoryDownload);
        sdm.addCommand(UnblockArtifactoryDownload);
        sdm.addCommand(IgnoreViolationForProject);
        sdm.addCommand(UnIgnoreViolationForProject);
        sdm.addCommand(CreateNewXrayIssue);
        // sdm.addEvent(RaisePullRequestOnBuildViolation);
        sdm.addGoalImplementation("Xray Scan", XrayScan, xrayScanner(sdm), { logInterpreter: LogSuppressor });
    },
};
