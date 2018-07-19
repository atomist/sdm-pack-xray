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
    HandleCommand,
    HandlerContext,
    HandlerResult,
    Parameter,
    SuccessPromise,
    Tags,
} from "@atomist/automation-client";

import {
    addressSlackChannels,
    buttonForCommand,
    menuForCommand,
    MenuSpecification,
    OptionGroup,
} from "@atomist/automation-client/spi/message/MessageClient";

import { BlockArtifactoryDownload } from "./BlockDownloads";

@CommandHandler("Ignore a given violation in a given project")
@Tags("artifactory", "security", "artifacts", "jfrog")
export class IgnoreViolationForProject implements HandleCommand {

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
        await ctx.messageClient.respond(
            BlockArtifactoryDownload.ignoreMessage(
                this.componentId,
                this.issueId,
                this.issueDescription),
            { id: this.issueId });
        return SuccessPromise;
    }

}
