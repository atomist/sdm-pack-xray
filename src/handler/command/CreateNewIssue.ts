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
    Tags,
} from "@atomist/automation-client";

import axios from "axios";

import * as stringify from "json-stringify-safe";

@CommandHandler("Create a new XRay Issue", "create xray issue")
@Tags("xray", "security", "issue", "violation", "jfrog")
export class CreateNewXrayIssue implements HandleCommand {

    @Parameter({
        displayName: "Issue identifier",
        pattern: /^.*$/,
        description: "the provider-unique identifer of the issue",
        validInput: "Any string",
        minLength: 1,
        maxLength: 100,
        required: true,
        displayable: true,
    })
    public id: string;
    @Parameter({
        displayName: "Issue description",
        pattern: /^.*$/,
        description: "the description of the security issue",
        validInput: "Any string",
        minLength: 1,
        maxLength: 500,
        required: true,
        displayable: true,
    })
    public description: string;

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

    public async handle(ctx: HandlerContext): Promise<HandlerResult> {
        const issue = await createIssue(this.id, this.description, this.componentId);
        if (issue) {
            logger.info("Create issue in xray: %j", issue);
            await ctx.messageClient.respond(`Created issue in xray ${issue.id}`);
        } else {
            return FailurePromise;
        }
    }
}

export function createIssue(
    id: string,
    description: string,
    componentId: string): Promise<any> {
    logger.info("Creating new issue in Xray on %s: %s", componentId, id);

    const now = new Date().toISOString();
    const issue: any = {
        type: "security",
        source_id: "atomist",
        url: "https://atomist.com/security/issues/123",
        created: now,
        description,
        provider: "Atomist",
        severity: "critical",
        summary: id,
        updated: now,
        modified: now,
        components: [
            {
                component_id: `gav://${componentId}`,
            },
        ],
    };
    // tslint:disable-next-line:max-line-length
    return axios.post(`${process.env.XRAY_ROOT}/api/v1/events`,
        issue,
        {
            auth: {
                username: process.env.XRAY_USER,
                password: process.env.XRAY_PASSWORD,
            },
        })
        .then(result => {
            logger.info("Created issue: %j", result.data);
            return result.data;
        }).catch(error => {
            logger.error("Error create issue: %j", stringify(error.message));
        });
}
