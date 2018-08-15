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

import { InMemoryProject } from "@atomist/automation-client/project/mem/InMemoryProject";
import * as assert from "power-assert";
import { gradleDependencies, updateGradleDependencies } from "../lib/handler/event/RaisePullRequestOnBuildViolation";

const stringNotation =
    `
plugins {
    id 'se.patrikerdes.use-latest-versions'
    id 'com.github.ben-manes.versions' version '$CurrentVersions.VERSIONS'
}
apply plugin: 'java'

repositories {
    mavenCentral()
}

dependencies {
    testCompile 'junit:junit:4.0'
}`;

const mapNotation =
    `
plugins {
    id 'se.patrikerdes.use-latest-versions'
    id 'com.github.ben-manes.versions' version '$CurrentVersions.VERSIONS'
}

apply plugin: 'java'

repositories {
    mavenCentral()
}

dependencies {
    testCompile group: 'junit', name: 'junit', version: '4.0'
}`;

const jfrogProjectExample =
    `
    apply plugin: 'war'

    dependencies {
        compile project(':shared'), 'commons-collections:commons-collections:3.2@jar', \\
             'commons-io:commons-io:1.2', 'commons-lang:commons-lang:2.4@jar'
        compile group: 'org.apache.wicket', name: 'wicket', version: '1.3.7'
        compile group: 'org.apache.struts', name: 'struts2-core', version: '2.3.14'
        compile group: 'junit', name: 'junit', version: '4.11'
        compile project(':api')
    }`;

describe("updateGradleDependency", () => {

    it("doesn't edit empty project", done => {
        const p = new InMemoryProject();
        updateGradleDependencies(p, []);
        done();
    });

    it("edits build.gradle files regardless of where they are", done => {
        const p = InMemoryProject.of(
            { path: "stuff/build.gradle", content: stringNotation },
            { path: "build.gradle", content: mapNotation });
        const buildFiles =
            [{
                path: "stuff/build.gradle", dependencies: [{
                    group: "junit", artifact: "junit", version: "4.0",
                    cves: [{ id: "CVE-123", summary: "CVE-123 fixes blah blah", fixVersion: "4.1" }],
                }],
            },
            {
                path: "build.gradle", dependencies: [{
                    group: "junit", artifact: "junit", version: "4.0",
                    cves: [{ id: "CVE-123", summary: "CVE-123 fixes blah blah", fixVersion: "4.1" }],
                }],
            }];

        updateGradleDependencies(p, buildFiles);
        assert(p.findFileSync("stuff/build.gradle").getContentSync().includes("4.1"));
        assert(p.findFileSync("build.gradle").getContentSync().includes("4.1"));
        done();
    });
    it("edits a real example from jfrogs project-examples training repo", done => {
        const p = InMemoryProject.of(
            // tslint:disable-next-line:max-line-length
            { path: "gradle-examples/4/gradle-example-ci-server/services/webservice/build.gradle", content: jfrogProjectExample });

        const buildFiles =
            // tslint:disable-next-line:max-line-length
            [{
                path: "gradle-examples/4/gradle-example-ci-server/services/webservice/build.gradle",
                dependencies: [{
                    group: "org.apache.wicket", artifact: "wicket", version: "1.3.7",
                    cves: [{ id: "CVE-123", summary: "CVE-123 fixes blah blah", fixVersion: "1.3.9" }],
                },
                {
                    group: "org.apache.struts", artifact: "struts2-core", version: "2.3.14",
                    cves: [{ id: "CVE-123", summary: "CVE-123 fixes blah blah", fixVersion: "[2.3.15.1,2.3.16)" }],
                }],
            }];

        // tslint:disable-next-line:max-line-length
        updateGradleDependencies(p, buildFiles);
        // tslint:disable-next-line:max-line-length
        assert(p.findFileSync("gradle-examples/4/gradle-example-ci-server/services/webservice/build.gradle")
            .getContentSync()
            .includes("1.3.9"));
        assert(p.findFileSync(
            "gradle-examples/4/gradle-example-ci-server/services/webservice/build.gradle")
            .getContentSync().includes("[2.3.15.1,2.3.16)"));
        done();
    });
});

describe("listDependencies", () => {

    it("edits build.gradle files regardless of where they are", done => {
        const p = InMemoryProject.of(
            { path: "stuff/build.gradle", content: stringNotation },
            { path: "build.gradle", content: mapNotation });
        gradleDependencies(p, "", { issues: [] })
            .then(r => {
                // tslint:disable-next-line:max-line-length
                assert.deepStrictEqual(r[0], {
                    dependencies: [
                        {
                            artifact: "junit",
                            group: "junit",
                            version: "4.0",
                            cves: [],
                        }],
                    path: "stuff/build.gradle",
                });
                assert.deepStrictEqual(r[1], {
                    dependencies: [
                        {
                            artifact: "junit",
                            group: "junit",
                            version: "4.0",
                            cves: [],
                        }],
                    path: "build.gradle",
                });
            }).then(() => done(), done);
    });
});
