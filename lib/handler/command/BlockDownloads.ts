/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    buttonForCommand,
    FailurePromise,
    logger,
    SuccessPromise,
} from "@atomist/automation-client";
import {
    CommandHandlerRegistration,
    CommandListenerInvocation,
} from "@atomist/sdm";
import * as slack from "@atomist/slack-messages";
// tslint:disable-next-line:import-blacklist
import axios from "axios";
import * as stringify from "json-stringify-safe";
import _ = require("lodash");

export const BlockDownloadParams = {
    issueDescription: { required: true, displayable: false, description: "the description of the issue" },
    issueId: { required: true, displayable: false, description: "the unique identifier of the issue" },
    componentId: {
        required: true, maxLength: 100, minLength: 8,
        validInput: "group:artifact:version",
        description: "the unique identifier of the component",
        displayName: "Component Identifier",
    },
};

export const BlockDownloadTags = ["artifactory", "security", "artifacts", "jfrog"];

export const BlockArtifactoryDownload: CommandHandlerRegistration<any> = {
    name: "BlockArtifactoryDownload",
    description: "Block downloads of a component from Artifactory",
    tags: BlockDownloadTags,
    parameters: BlockDownloadParams,
    listener: async (cli: CommandListenerInvocation<any>): Promise<any> => {
        const params = cli.parameters;
        const config = await getRepoConfig();
        if (config) {
            const pattern = params.componentId.split(":").join("/") + "/**";

            if (!config.excludesPattern || config.excludesPattern === "") {
                config.excludesPattern = pattern;
            } else {
                config.excludesPattern += "," + pattern;
            }

            await setRepoConfig(config);
            await cli.context.messageClient.respond(
                blockedMessage(params),
                { id: params.issueId });
            return SuccessPromise;
        } else {
            return FailurePromise;
        }
    },
};
export const UnblockArtifactoryDownload: CommandHandlerRegistration<any> = {
    name: "UnblockArtifactoryDownload",
    tags: BlockDownloadTags,
    description: "Unblock downloads of a component from Artifactory",
    parameters: BlockDownloadParams,
    listener: async (cli: CommandListenerInvocation<any>): Promise<any> => {
        const config = await getRepoConfig();
        const params = cli.parameters;
        if (config) {
            const pattern = params.componentId.split(":").join("/") + "/**";

            if (config.excludesPattern && config.excludesPattern !== "") {
                const exclusions = config.excludesPattern.split(",");
                _.remove(exclusions, ex => ex === pattern);
                config.excludesPattern = exclusions;
            }

            await setRepoConfig(config);
            await cli.context.messageClient.respond(
                defaultMessage(params),
                { id: params.issueId });
            return SuccessPromise;
        } else {
            return FailurePromise;
        }
    },
};

export const IgnoreViolationForProject: CommandHandlerRegistration<any> = {
    name: "IgnoreViolationForProject",
    description: "Ignore a given violation in a given project",
    tags: BlockDownloadTags,
    parameters: BlockDownloadParams,
    listener: async (cli: CommandListenerInvocation<any>): Promise<any> => {
        const params = cli.parameters;
        await cli.context.messageClient.respond(
            ignoreMessage(params),
            { id: params.issueId });
        return SuccessPromise;
    },
};

export const UnIgnoreViolationForProject: CommandHandlerRegistration<any> = {
    name: "UnIgnoreViolationForProject",
    description: "Re-enable notifications for a given violation in a given project",
    tags: BlockDownloadTags,
    parameters: BlockDownloadParams,
    listener: async (cli: CommandListenerInvocation<any>): Promise<any> => {
        const params = cli.parameters;
        await cli.context.messageClient.respond(
            defaultMessage(params),
            { id: params.issueId });
        return SuccessPromise;
    },
};

function blockedMessage(params: any): slack.SlackMessage {
    return generateMessage(
        params,
        "Downloads from Artifactory have been blocked",
        [
            buttonForCommand(
                { text: "Unblock downloads" },
                UnblockArtifactoryDownload.name,
                params,
            ),
        ]);
}

function generateMessage(
    params: any,
    attachmentText: string,
    actions?: slack.Action[]): slack.SlackMessage {

    const text = `*${params.issueId}*: ${params.issueDescription}:\n*${params.componentId}*`;

    return {
        text: "*Incoming Xray Security Issue*",
        attachments: [
            {
                text,
                color: "warning",
                fallback: "Security Issue",
                mrkdwn_in: ["text"],
            },
            {
                text: "There is no known fix for this issue",
                color: "danger",
                fallback: "Security Issue",
                mrkdwn_in: ["text"],
            },
            {
                text: attachmentText,
                fallback: attachmentText,
                mrkdwn_in: ["text"],
                color: "good",
                actions,
            },
        ],
    };
}

function ignoreMessage(params: any): slack.SlackMessage {
    const actions = [
        buttonForCommand(
            { text: "Re-enable" },
            UnIgnoreViolationForProject.name,
            params,
        ),
    ];
    return generateMessage(
        params,
        "Notifications about this issue will be ignored for this project",
        actions);
}

export function defaultMessage(params: any): slack.SlackMessage {
    return generateMessage(
        params,
        "What can I do for you now?",
        [
            buttonForCommand({
                text: "Block all downloads",
            },
                BlockArtifactoryDownload.name,
                params),
            buttonForCommand({
                text: "Ignore for this project",
            },
                IgnoreViolationForProject.name,
                params),
        ]);
}

export function getRepoConfig(): Promise<any> {
    // tslint:disable-next-line:max-line-length
    return axios.get(`${process.env.ARTIFACTORY_ROOT}/api/repositories/libs-release`,
        { headers: { "X-JFrog-Art-Api": process.env.ARTIFACTORY_TOKEN } })
        .then(result => {
            logger.info("Found repo config for %j", result.data);
            return result.data;
        }).catch(error => {
            logger.error("Error getting repo config: %j", stringify(error.message));
        });
}

export function setRepoConfig(repoConfig: any): Promise<any> {
    const url = `${process.env.ARTIFACTORY_ROOT}/api/repositories/libs-release`;
    logger.info("Setting config of %s to %j", url, repoConfig);

    return axios.post(
        url,
        repoConfig,
        {
            headers: {
                "Content-Type": "application/json",
                "X-JFrog-Art-Api": process.env.ARTIFACTORY_TOKEN,
            },
        });
}
