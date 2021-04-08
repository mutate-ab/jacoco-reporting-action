const parser = require('xml2js');
const fs = require("fs");
const path = require('path');

const jacoco = {
    counters: ["CLASS", "INSTRUCTION", "LINE", "COMPLEXITY", "METHOD", "BRANCH"]
}

async function generateDiffReport(filePath, fileDiffPath) {
    const report                = await processFile(filePath);
    const reportToDiffAgainst   = await processFile(fileDiffPath);
    const diff                  = diffReports(report, reportToDiffAgainst);

    return {
        diff: diff,
        report: report,
        reportToDiffAgainst: reportToDiffAgainst
    };
}

function metricDivision(a, b) {
    if (b === 0) {
        return 0;
    } else {
        return a / b;
    }
}

function diffReports(report, reportToDiffAgainst) {
    const results = {
        added: [],
        removed: [],
        deltas: [],
        stats: {}
    }
    const reportFiles = report.files;
    const reportToDiffAgainstFiles = reportToDiffAgainst.files;

    const uniqueFilePaths = new Set();
    const filePaths = Object.keys(reportFiles).concat(Object.keys(reportToDiffAgainstFiles));
    for (const path of filePaths) {
        uniqueFilePaths.add(path);
    }

    for (const file of uniqueFilePaths.keys()) {
        if (reportFiles[file] === undefined) {
            results.removed.push(file);
        } else if (reportToDiffAgainstFiles[file] === undefined) {
            results.added.push(file);
        } else {
            results.deltas.push({
                file: file,
                diff: diffFile(reportFiles[file], reportToDiffAgainstFiles[file])
            });
        }
    }

    for (const counterType of jacoco.counters) {
        results.stats[counterType] = generateDeltas(
            counterType,
            report.stats[counterType].covered,
            report.stats[counterType].missed,
            reportToDiffAgainst.stats[counterType].covered,
            reportToDiffAgainst.stats[counterType].missed
        );
    }

    return results;
}

function generateDeltas(counterType, covered, missed, coveredDiff, missedDiff) {
    switch (counterType) {
        case "COMPLEXITY":
            const result = covered + missed;
            const resultDiff = coveredDiff + missedDiff;
            return {
                result: result,
                resultDiff: resultDiff,
                delta: result - resultDiff,
            }
        default:
            const resultPercentage = metricDivision(covered, covered + missed);
            const resultDiffPercentage = metricDivision(coveredDiff, coveredDiff + missedDiff);
            return {
                result: resultPercentage,
                resultDiff: resultDiffPercentage,
                delta: resultPercentage - resultDiffPercentage,
            }
    }
}

function diffFile(file, fileDiff) {
    const result = {};
    for (const counterType of jacoco.counters) {
        result[counterType] = generateDeltas(
            counterType,
            file[counterType].covered,
            file[counterType].missed,
            fileDiff[counterType].covered,
            fileDiff[counterType].missed
        )
    }
    return result;
}

async function processFile(path) {
    const rawReport = await fs.promises.readFile(path, "utf-8");
    const xmlReport = await parser.parseStringPromise(rawReport);

    return processReport(xmlReport.report);
}

function processReport(report) {
    const result = {};
    result.files = {};
    result.stats = {};

    // Initiate counter statitics
    for (const counter of jacoco.counters) {
        result.stats[counter] = {
            missed: 0,
            covered: 0,
            percentage: 0,
        }
    }

    const packages = report.package;
    for (const package of packages) {
        const packageName = package.$.name;
        const sourceFiles = package.sourcefile;
        for (const sourceFile of sourceFiles) {
            const sourceName = path.join(packageName, sourceFile.$.name);
            result.files[sourceName] = {};
            let counters = sourceFile.counter;

            if (counters === undefined) {
                counters = [];
                for (const counter of jacoco.counters) {
                    counters.push({
                        $: {
                            type: counter,
                            covered: 0,
                            missed: 0,
                            percentage: 0
                        }
                    });
                }
            }

            for (const counter of counters) {
                const counterType = counter.$.type;
                const missed = parseInt(counter.$.missed);
                const covered = parseInt(counter.$.covered);
                let percentage = 0;
                if ((missed + covered) !== 0) {
                    percentage = covered / (missed + covered);
                }

                result.stats[counterType].missed += missed;
                result.stats[counterType].covered += covered;
                result.files[sourceName][counterType] = {
                    missed: missed,
                    covered: covered,
                    percentage: percentage
                }
            }

            // Fill missing branches with zero
            for (const counter of jacoco.counters) {
                if (!(counter in result.files[sourceName])) {
                    result.files[sourceName][counter] = {
                        missed: 0,
                        covered: 0,
                        percentage: 0
                    }
                }
            }
        }

        // Calculate percentages for stats
        for (const counterType of jacoco.counters) {
            const missed = result.stats[counterType].missed;
            const covered = result.stats[counterType].covered;
            let percentage = 0;
            if ((missed + covered) !== 0) {
                percentage = covered / (missed + covered);
            }

            result.stats[counterType].percentage = percentage;
        }
    }
    return result;
}

module.exports = {
    generateDiffReport: generateDiffReport,
    processFile: processFile
}
