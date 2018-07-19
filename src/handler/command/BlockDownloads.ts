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
    CommandHandler,
    FailurePromise,
    HandleCommand,
    HandlerContext,
    HandlerResult,
    logger,
    Parameter,
    SuccessPromise,
    Tags,
} from "@atomist/automation-client";

import {
    buttonForCommand,
} from "@atomist/automation-client/spi/message/MessageClient";

import * as slack from "@atomist/slack-messages/SlackMessages";

import axios from "axios";

import * as stringify from "json-stringify-safe";
import { IgnoreViolationForProject } from "./IgnoreViolation";
import { UnblockArtifactoryDownload } from "./UnblockDownloads";
import { UnIgnoreViolationForProject } from "./UnIgnoreViolation";

@CommandHandler("Block downloads of a component from Artifactory")
@Tags("artifactory", "security", "artifacts", "jfrog")
export class BlockArtifactoryDownload implements HandleCommand {

    public static defaultMessage(
        componentId: string,
        issueId: string,
        issueDescription: string,
    ): slack.SlackMessage {
        const blockCmd = new BlockArtifactoryDownload();
        blockCmd.componentId = componentId;
        blockCmd.issueDescription = issueDescription;
        blockCmd.issueId = issueId;

        const ignoreCmd = new IgnoreViolationForProject();
        ignoreCmd.componentId = componentId;
        ignoreCmd.issueDescription = issueDescription;
        ignoreCmd.issueId = issueId;

        const actions = [
            buttonForCommand({
                text: "Block all downloads",
            }, blockCmd),
            buttonForCommand({
                text: "Ignore for this project",
            }, ignoreCmd),
        ];
        return this.generateMessage(
            componentId,
            issueId,
            issueDescription,
            "What can I do for you now, Dave?",
            actions);
    }

    public static ignoreMessage(
        componentId: string,
        issueId: string,
        issueDescription: string,
    ): slack.SlackMessage {
        const enableCmd = new UnIgnoreViolationForProject();
        enableCmd.componentId = componentId;
        enableCmd.issueDescription = issueDescription;
        enableCmd.issueId = issueId;

        const actions = [
            buttonForCommand(
                { text: "Re-enable" },
                enableCmd,
            ),
        ];
        return this.generateMessage(
            componentId,
            issueId,
            issueDescription,
            "Notifications about this issue will be ignored for this project",
            actions);
    }
    public static blockedMessage(
        componentId: string,
        issueId: string,
        issueDescription: string,
    ): slack.SlackMessage {

        const unblockCmd = new UnblockArtifactoryDownload();
        unblockCmd.issueId = issueId;
        unblockCmd.issueDescription = issueDescription;
        unblockCmd.componentId = componentId;
        const actions = [
            buttonForCommand(
                { text: "Unblock downloads" },
                unblockCmd,
            ),
        ];
        return this.generateMessage(
            componentId,
            issueId,
            issueDescription,
            "Downloads from Artifactory have been blocked",
            actions);
    }

    private static generateMessage(
        componentId: string,
        issueId: string,
        issueDescription: string,
        attachmentText: string,
        actions?: slack.Action[]): slack.SlackMessage {

        const text = `*${issueId}*: ${issueDescription}:\n*${componentId}*`;

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

    @Parameter({
        displayName: "Component Identifier",
        pattern: /^.*$/,
        description: "the unique identifier of the component",
        validInput: "group:artifact:version",
        minLength: 8,
        maxLength: 100,
        required: true,
        displayable: true,
    })
    public componentId: string;

    @Parameter({
        pattern: /^.*$/,
        description: "the unique identifier of the issue",
        required: true,
        displayable: false,
    })
    public issueId: string;

    @Parameter({
        pattern: /^.*$/,
        description: "the description of the issue",
        required: true,
        displayable: false,
    })
    public issueDescription: string;

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        const config = await getRepoConfig();
        if (config) {
            const pattern = this.componentId.split(":").join("/") + "/**";

            if (!config.excludesPattern || config.excludesPattern === "") {
                config.excludesPattern = pattern;
            } else {
                config.excludesPattern += "," + pattern;
            }

            await setRepoConfig(config);
            await ctx.messageClient.respond(
                BlockArtifactoryDownload.blockedMessage(
                    this.componentId,
                    this.issueId,
                    this.issueDescription),
                { id: this.issueId });
            return SuccessPromise;
        } else {
            return FailurePromise;
        }
    }
}

export function getRepoConfig() {
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
