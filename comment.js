function createCommentFromDiffReport(report, opts = {}) {
    let res = "";
    res += buildHeader("JaCoCo report") + "\n\n";
    res += buildSubHeader("Stats coverage") + "\n";
    res += buildStats(report.report.stats) + "\n";
    res += buildSubHeader("Delta coverage") + "\n";
    res += buildDeltaStats(report.diff.stats) + "\n";

    res += buildSubHeader("Changed files") + "\n";
    const sortOn = opts.sortFilesOn || "INSTRUCTION";
    const deltas = report.diff.deltas.sort((a, b) => {
        return -(Math.abs(a.diff[sortOn].delta) - Math.abs(b.diff[sortOn].delta));
    });
    res += buildFileDeltas(deltas, sortOn) + "\n";

    return res;
}

function createCommentFromFile(file) {
    let res = "";
    res += buildHeader("JaCoCo report") + "\n\n";
    res += buildSubHeader("Stats coverage") + "\n";
    res += buildStats(file.stats) + "\n";
    return res;
}

function buildHeader(text) {
    return "### " + text;
}

function buildSubHeader(text) {
    return "##### " + text;
}

function formatValue(counterType, value) {
    switch (counterType) {
        case "COMPLEXITY":
            return value;
        default:
            return fractionToPercentage(value) + "%";
    }
}

function buildDeltaStats(stats) {
    let vals = []
    Object.keys(stats).forEach((key) => {
        const {result, resultDiff, delta} = stats[key];
        let compared = `${formatValue(key, result)} (${formatValue(key, resultDiff)})`;
        let change = formatValue(key, delta);
        let status = emojiFromDeltaValue(key, delta);
        if (delta > 0) {
            change = "+" + change;
        }
        vals.push([key, compared, change, status])
    })
    return buildTable(["Metric", "Values", "Change", "Status"], vals);
}

function buildStats(stats) {
    let vals = []
    Object.keys(stats).forEach((key) => {
        const {covered, missed, percentage} = stats[key];
        vals.push([key, `${covered}/${covered + missed} (${fractionToPercentage(percentage)}%)`])
    })
    return buildTable(["Metric", "Covered"], vals);
}

function buildFileDeltas(files, mainCounterType) {
    let vals = [];
    const max = Math.min(files.length, 25);
    for (let i = 0; i < max; i++) {
        const diffFile = files[i];
        const mainCounterDiff = diffFile.diff[mainCounterType].delta;
        if (mainCounterDiff == 0) {
            break;
        }
        vals.push([
            diffFile.file,
            formatValue(mainCounterType, mainCounterDiff),
            formatValue("COMPLEXITY", diffFile.diff["COMPLEXITY"].delta),
            emojiFromDeltaValue(mainCounterType, mainCounterDiff)
        ]);
    }

    return buildTable(["Filename", "Coverage difference", "Complexity difference", "Status"], vals);
}

function buildTable(headers, vals) {
    let res = ""
    res += buildTableHeader(headers) + "\n";

    for (const val of vals) {
        res += `|`
        for (const item of val) {
            res += item + "|"
        }
        res += `\n`;
    }
    return res;
}

function buildTableHeader(headers) {
    let res = "|";
    for (const header of headers) {
        res += header + "|";
    }
    res += "\n|";
    for (const header of headers) {
        res += ":--|";
    }

    return res;
}

function emojiFromDeltaValue(key, val) {
    if (key === "COMPLEXITY") {
        val = -val;
    }

    if (val < 0) {
        return "⚠️";
    } else if (val > 0) {
        return "🟢";
    } else {
        return "😐";
    }
}

function fractionToPercentage(aNumber) {
    return Math.round(aNumber * 10000)/100;
}

module.exports = {
    createCommentFromFile: createCommentFromFile,
    createCommentFromDiffReport: createCommentFromDiffReport
}
