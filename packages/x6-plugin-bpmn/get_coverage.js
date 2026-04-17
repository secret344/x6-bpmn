const fs = require("fs");
const report = JSON.parse(fs.readFileSync("coverage_report.json", "utf8"));
Object.keys(report).forEach(fullPath => {
  const data = report[fullPath];
  const uncoveredLines = [];
  const s = data.s || {};
  const statementMap = data.statementMap || {};
  Object.keys(s).forEach(id => {
    if (s[id] === 0) {
      if (statementMap[id]) uncoveredLines.push(statementMap[id].start.line);
    }
  });

  const uncoveredBranches = [];
  const b = data.b || {};
  const branchMap = data.branchMap || {};
  Object.keys(b).forEach(id => {
    (b[id] || []).forEach((count, index) => {
      if (count === 0 && branchMap[id] && branchMap[id].loc) {
        uncoveredBranches.push(branchMap[id].loc.start.line);
      }
    });
  });

  const combined = [...new Set([...uncoveredLines, ...uncoveredBranches])].sort((a,b)=>a-b);
  if (combined.length > 0) {
     const ranges = [];
     let start = combined[0], end = start;
     for (let i = 1; i < combined.length; i++) {
       if (combined[i] === end + 1) end = combined[i];
       else {
         ranges.push(start === end ? `${start}` : `${start}-${end}`);
         start = combined[i]; end = start;
       }
     }
     if (combined.length > 0) ranges.push(start === end ? `${start}` : `${start}-${end}`);
     console.log(`${fullPath.split("/src/").pop()}: ${ranges.join(",")}`);
  }
});
