const cov = require('./coverage/coverage-final.json');
const files = Object.keys(cov);
for (const f of files) {
  const data = cov[f];
  const uncovStmts = [];
  for (const [k,v] of Object.entries(data.s)) {
    if (v === 0) uncovStmts.push(k);
  }
  const uncovBranches = [];
  for (const [k,v] of Object.entries(data.b)) {
    const arr = v;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === 0) uncovBranches.push(k + '[' + i + ']');
    }
  }
  const uncovFns = [];
  for (const [k,v] of Object.entries(data.f)) {
    if (v === 0) uncovFns.push(k);
  }
  if (uncovStmts.length || uncovBranches.length || uncovFns.length) {
    const shortName = f.split('/src/')[1] || f;
    console.log('---', shortName, '---');
    if (uncovStmts.length) {
      console.log('  Stmts:', uncovStmts.map(s => {
        const loc = data.statementMap[s];
        return 'L' + loc.start.line;
      }).join(', '));
    }
    if (uncovBranches.length) {
      console.log('  Branches:', uncovBranches.map(b => {
        const bk = b.split('[')[0];
        const loc = data.branchMap[bk];
        return b + '(L' + loc.loc.start.line + ')';
      }).join(', '));
    }
    if (uncovFns.length) {
      console.log('  Fns:', uncovFns.map(fk => {
        const loc = data.fnMap[fk];
        return loc.name + '(L' + loc.loc.start.line + ')';
      }).join(', '));
    }
  }
}
