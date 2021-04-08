const core = require('@actions/core');
const github = require('@actions/github');

const generateDiffReport = require("./report").generateDiffReport;
const processFile = require("./report").processFile;
const createCommentFromDiffReport = require("./comment").createCommentFromDiffReport;
const createCommentFromFile = require("./comment").createCommentFromFile;

async function action() {
    const filePath                  = core.getInput("path");
    const filePathDiff              = core.getInput("path-for-diff");
    const denyDeltaCounterType      = core.getInput("deny-delta-counter-type");
    const minimumCoverage           = core.getInput("minimum-coverage");
    const minimumCoverageCounter    = core.getInput("minimum-coverage-counter");
    const client                    = github.getOctokit(core.getInput("token"));

    const event = github.context.eventName;
    core.info(`Github event: ${event}`);
    if (event !== "pull_request" && event !== "push") {
        core.setFailed(`Only pull request and push is supported, ${event} is not supported`);
        return;
    }

    const prNumber = github.context.payload.pull_request.number;

    let file;
    if (filePathDiff) {
        const diffReport = await generateDiffReport(filePath, filePathDiff);
        await client.issues.createComment({
            issue_number: prNumber,
            body: createCommentFromDiffReport(diffReport),
            ...github.context.repo
        });
    
        if (denyDeltaCounterType) {
            const delta = report.diff.stats[denyDeltaCounterType].delta;
            if (delta < 0) {
                core.setFailed(`Metric ${denyDeltaCounterType} is ${delta} and needs to be above 0\n`);
            }
        }

        file = diffReport.report;
    } else {
        file = await processFile(filePath);

        await client.issues.createComment({
            issue_number: prNumber,
            body: createCommentFromFile(file),
            ...github.context.repo
        });
    }

    if (minimumCoverage) {
        const coverageNeeded = parseFloat(minimumCoverage);
        const counter = file.stats[minimumCoverageCounter];
        if (counter.percentage < coverageNeeded) {
            core.setFailed(`Metric ${minimumCoverageCounter} is ${counter.percentage} and needs to be above ${coverageNeeded}\n`);
        }
    }
}

action().catch(err => {
    core.setFailed(err);
});
