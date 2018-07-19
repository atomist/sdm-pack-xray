import {
    logger,
} from "@atomist/automation-client";
import "mocha";

import * as fs from "fs";

import * as assert from "power-assert";
import { buildViolations, latestBuildsOnly } from "../src/handler/event/RaisePullRequestOnBuildViolation";

describe("buildViolations", () => {

    // atomisthq-step1-create-application-war-file:20
    // it("we can find violations from a build-id", done => {
    //     buildViolations("atomisthq-step1-create-application-war-file", "105").then(result => {
    //         logger.info("Got response %j", JSON.stringify(result.build));
    //         done();
    //     });
    // }).timeout(5000);

    it("can remove all but the latest build violations", done => {
        fs.readFile("test/example-build-violations-due-to-new-issue.json", (error, content) => {
            const violation = latestBuildsOnly(JSON.parse(content.toString()).data.XrayViolation[0]);
            // fs.writeFileSync("test/filtered-new-issue-builds.json", JSON.stringify(violation));
            fs.readFile("test/filtered-new-issue-builds.json", (_, c) => {
                assert.deepEqual(violation, JSON.parse(c.toString()));
                done();
            });

        });
    });
});
