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
    EventFired,
    FailurePromise,
    File,
    GitCommandGitProject,
    gitHubRepoLoader,
    GitHubRepoRef,
    HandlerContext,
    HandlerResult,
    logger,
    Project,
    SuccessPromise,
    toPromise,
} from "@atomist/automation-client";

import axios from "axios";

import * as stringify from "json-stringify-safe";

import { XrayViolations } from "../../typings/types";
import * as types from "../../typings/types";

import * as GraphQL from "@atomist/automation-client/lib/graph/graphQL";

import { isNew } from "./Cache";

import * as _ from "lodash/";
import * as uuid from "uuid";

import { EventHandlerRegistration } from "@atomist/sdm";
import { defaultMessage } from "../command/BlockDownloads";

const handleViolation = async (e: EventFired<XrayViolations.Subscription>, ctx: HandlerContext) => {

    const violation = latestBuildsOnly(e.data.XrayViolation[0]);

    // buildId is the same for each issue when triggered by a build...
    const buildIds = _.uniq(_.flatten(violation.issues.map(issue => {
        return issue.impacted_artifacts.map(art => {
            return art.display_name;
        });
    })));

    if (isAtomistIssue(violation)) {
        return handleAtomistIssue(ctx, violation);
    }

    logger.info("Found builds: %j", buildIds);
    const buildId = _.first(buildIds);

    if (!isNew(buildId)) {
        logger.warn("Received duplicate event - ignoring");
        return SuccessPromise;
    }
    const bits = buildId.split(":");
    const buildName = bits[0];
    const buildNumber = bits[1];

    const sha = await buildToCommit(buildName, buildNumber);

    const buildsForCommit = await getBuildsForCommit(ctx, sha, buildId);
    if (buildsForCommit.Commit.length >= 1) {
        const build = buildsForCommit.Commit[0].builds[0];
        const buildInfo = JSON.parse(build.data);
        const buildDir = (buildInfo ? buildInfo.buildDir : "");
        const violations = await buildViolations(buildName, buildNumber);
        const repo = new GitHubRepoRef(build.repo.owner, build.repo.name, build.push.branch);
        const loader = gitHubRepoLoader({ token: process.env.GITHUB_TOKEN });
        const project = await loader(repo);
        const branch = await project.createBranch("atm-" + uuid.v4());

        if (!branch.success) {
            logger.warn("Error creating branch due to %j", branch.error);
            return FailurePromise;
        }

        const buildFiles = await gradleDependencies(project, buildDir, violations);

        const body = generateBody(buildFiles);

        updateGradleDependencies(project, buildFiles);
        logger.info("Editor succeeded, committing");

        const title = "Update dependencies due to XRay Violations";
        const commited = await project.commit(title);
        if (!commited.success) {
            logger.warn("Error creating commit %j", commited.error);
            return FailurePromise;
        }

        logger.info("Commit success. Pushing branch...");
        const pushed = await project.push();
        if (!pushed.success) {
            logger.warn("Error pushing %j", pushed.error);
            return FailurePromise;
        }
        logger.info("Push success. Creating PR with title %j/%j", title, body);
        const commandGit = project as GitCommandGitProject;

        const pr = await commandGit.raisePullRequest(title, body, repo.sha);
        if (pr.success) {
            logger.info("PR raised - profit");
            return SuccessPromise;
        } else {
            logger.warn("PR creation failed %j", pr.error);
            return FailurePromise;
        }
    }
    logger.info("Could not find a commit %j", sha);
    return SuccessPromise;
};

export const RaisePullRequestOnBuildViolation: EventHandlerRegistration<any> = {
    name: "RaisePullRequestOnBuildViolation",
    description: "Raise a PR when there are fixable violations",
    subscription: GraphQL.subscription("XrayViolations"),
    tags: ["xray", "PR", "security", "jfrog"],
    listener: handleViolation,
};

export function updateGradleDependencies(project: Project, files: BuildFile[]) {
    files.forEach(file => {
        logger.info("Processing file %s", file.path);
        const buildFile = project.findFileSync(file.path);
        if (!buildFile) {
            throw new Error(`Could not find file: ${file.path} in project`);
        }
        file.dependencies.forEach(dep => {
            dep.cves.forEach(cve => {
                updateDependency(
                    buildFile,
                    dep.group,
                    dep.artifact,
                    dep.version,
                    cve.fixVersion,
                    stringRe(dep.group, dep.artifact),
                    mapRe(dep.group, dep.artifact));
            });
        });
    });
}

async function getBuildsForCommit(
    ctx: HandlerContext,
    sha: string,
    buildId: string): Promise<types.FindBuildForCommit.Query> {
    const buildsForCommit = await ctx.graphClient
        .query<types.FindBuildForCommit.Query, types.FindBuildForCommit.Variables>(
            {
                name: "findBuildForCommit",
                variables:
                    { sha, buildId: `^.*${buildId}$` },
            });
    logger.info("Got graphql response %j", buildsForCommit);
    return buildsForCommit;
}

function generateBody(files: BuildFile[]): string {
    const lines: string[] = [];
    const deps = _.uniqBy(
        _.flatten(files.map(file => file.dependencies)),
        item => `${item.group}:${item.artifact}`);

    deps.forEach(dep => {
        dep.cves.forEach(cve => {
            // tslint:disable-next-line:max-line-length
            const line = `**${dep.group}:${dep.artifact}:${dep.version} => ${cve.fixVersion}**\n- ${cve.id}: ${cve.summary}`;
            lines.push(line);
        });
    });
    return lines.join("\n\n");
}

export function buildViolations(buildName: string, buildNumber: string): Promise<any> {
    logger.info("Grabbing build violations for %j:%j", buildName, buildNumber);
    // TODO - get this in to config
    // tslint:disable-next-line:max-line-length
    return axios.get(`${process.env.XRAY_ROOT}/api/v2/summary/build?build_name=${buildName}&build_number=${buildNumber}`,
        {
            auth: {
                username: process.env.XRAY_USER,
                password: process.env.XRAY_PASSWORD,
            },
        })
        .then(result => {
            logger.info("Found build violations for %j", result.data.build);
            return result.data;
        }).catch(error => {
            logger.error("Error getting build violations: %j", stringify(error.message));
        });
}

function buildToCommit(buildName: string, buildNumber: string): Promise<string> {
    logger.info("Grabbing build info for %j:%j", buildName, buildNumber);
    // TODO - get this in to config
    // tslint:disable-next-line:max-line-length
    return axios.get(`${process.env.ARTIFACTORY_ROOT}/api/build/${buildName}/${buildNumber}`,
        { headers: { "X-JFrog-Art-Api": process.env.ARTIFACTORY_TOKEN } })
        .then(result => {
            logger.info("Found build info: %j", result.status);
            return result.data.buildInfo.vcsRevision;
        }).catch(error => {
            logger.error("Error getting build info: %j", stringify(error));
        });
}
export interface Dependency {
    group: string;
    artifact: string;
    version: string;
    cves: CveDetail[];
}

export interface BuildFile {
    path: string;
    dependencies: Dependency[];
}

function mapRe(group: string, artifact: string): RegExp {
    // tslint:disable-next-line:max-line-length
    return new RegExp(`group\\s*:\\s*["'](${group})["']\\s*,\\s*name\\s*:\\s*["'](${artifact})["']\\s*,\\s*version\\s*:\\s*["'](.*?)["']`, "gm");
}

function stringRe(group: string, artifact: string): RegExp {
    return new RegExp(`[\"'](${group}):(${artifact}):(.*?)[\"']`, "gm");
}

function extractDeps(file: File, re: RegExp, violations: any): Dependency[] {
    const content = file.getContentSync();
    const deps: Dependency[] = [];
    let match: RegExpExecArray;
    logger.info("Extracting dependencies from: %s", file.path);
    // tslint:disable-next-line:no-conditional-assignment
    while (match = re.exec(content)) {
        const group = match[1];
        const artifact = match[2];
        const version = match[3];
        deps.push({
            group,
            artifact,
            version,
            cves: cvesForDependency(violations, group, artifact, version),
        });
    }
    logger.info("Found %j deps in %s", deps.length, file.path);
    return deps;
}

export async function gradleDependencies(project: Project, buildDir: string, violations: any): Promise<BuildFile[]> {
    const globRoot = buildDir === "" ? buildDir : buildDir.replace(/\/^/, "") + "/";
    const files = await toPromise(project.streamFiles(globRoot.replace(/\/^/, "") + "**/build.gradle"));
    logger.info("Looking at: %j build.gradle's", files.length);
    return files.map(file => {
        logger.info("Looking for dependencies in: %j", file.path);
        return {
            path: file.path,
            // tslint:disable-next-line:max-line-length
            dependencies: _.concat(
                extractDeps(file, mapRe("\\S+?", "\\S+?"), violations),
                extractDeps(file, stringRe("\\S+?", "\\S+?"), violations)),
        };
    });
}

function updateDependency(
    file: File,
    group: string,
    artifact: string,
    fromVersion: string,
    toVersion: string,
    ...regexs: RegExp[]) {
    regexs.forEach(re => {
        const content = file.getContentSync();
        file.setContentSync(content.replace(re, str => {
            // tslint:disable-next-line:max-line-length
            logger.info("Found match for %s:%s:%s in %s, updating to %s", group, artifact, fromVersion, file.path, toVersion);
            return str.replace(fromVersion, toVersion);
        }));
    });
}

export interface CveDetail {
    id: string;
    summary: string;
    fixVersion: string;
}

export function cvesForDependency(violations: any, group: string, artifact: string, version: string): CveDetail[] {
    const cve: CveDetail[] = [];
    const dep = `${group}:${artifact}:${version}`;
    if (violations.issues) {
        violations.issues.forEach((issue: any) => {
            if (issue.components) {
                issue.components.forEach((component: any) => {
                    if (component.component_id === `gav://${group}:${artifact}:${version}` &&
                        component.fixed_versions && component.fixed_versions.length >= 1) {
                        // TODO hack to simplify demo
                        if (cve.length <= 0) {
                            logger.info("Found fix for %s: %s", dep, component.fixed_versions[0]);
                            cve.push({
                                id: issue.cves[0].cve,
                                summary: issue.summary,
                                fixVersion: component.fixed_versions[0],
                            });
                        }
                    }
                });
            } else {
                logger.warn("Found no components for %s in %j", dep, issue);
            }
        });
    } else {
        logger.warn("Found no issues for %s in %j", dep, violations);
    }

    return cve;
}
/**
 * Remove all but the latest build violations for each build
 * but only if there is a single issue i.e. triggered by a new issue
 * @param violations
 */
export function latestBuildsOnly(violation: XrayViolations.XrayViolation): XrayViolations.XrayViolation {
    if (violation.issues.length !== 1) {
        logger.info("Not removing duplicate builds...");
        return violation;
    }

    const grouped: any = _.groupBy(
        violation.issues[0].impacted_artifacts,
        ((a: any) => a.display_name.split(":")[0]));

    violation.issues[0].impacted_artifacts = _.reduce(
        Object.keys(grouped),
        ((acc, g: string) => {
            // tslint:disable-next-line:radix
            const list = _.sortBy(grouped[g], (g1: any) => parseInt(g1.display_name.split(":")[1]));
            acc.push(_.last(list));
            return acc;
        }),
        [] as any[]);

    return violation;
}

export function isAtomistIssue(violation: XrayViolations.XrayViolation): boolean {
    return violation.issues.length === 1 && violation.issues[0].provider === types.XrayIssueProvider.Atomist;
}

interface Impact {
    impacted: XrayViolations.ImpactedArtifacts[];
    sha: string;
    repo: types.FindBuildForCommit.Repo;
}
export async function handleAtomistIssue(
    ctx: HandlerContext,
    violation: XrayViolations.XrayViolation): Promise<HandlerResult> {
    logger.info("New Security issue...");
    const issue = violation.issues[0];
    const buildIds = _.uniq(issue.impacted_artifacts.map(art => art.display_name));

    const toReport: Impact[] = await Promise.all(_.map(buildIds, async buildId => {
        const buildBits = buildId.split(":");
        const sha = await buildToCommit(buildBits[0], buildBits[1]);
        if (sha) {
            const buildsForCommit = await getBuildsForCommit(ctx, sha, buildId);
            if (buildsForCommit.Commit.length >= 1) {
                return {
                    impacted: issue.impacted_artifacts.filter(a => a.display_name === buildId),
                    sha,
                    repo: buildsForCommit.Commit[0].builds[0].repo,
                };
            }
        }
        return undefined;
    }));

    if (toReport.length > 0) {
        toReport.map(impact => {
            const cid = impact.impacted[0].infected_files[0].display_name;
            const msg = defaultMessage({ componentId: cid, issueId: issue.summary, issueDescription: issue.description });
            return ctx.messageClient.addressChannels(
                msg, impact.repo.channels[0].channelId, { id: issue.summary });
        });
    }
    return SuccessPromise;
}
