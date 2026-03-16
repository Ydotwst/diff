// ─── LCS diff ──────────────────────────────────────────────────────────────

function lcs(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({length: m + 1}, () => new Int32Array(n + 1));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] + 1 : Math.max(dp[i-1][j], dp[i][j-1]);
  const ops = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i-1] === b[j-1]) { ops.push({t:'eq', a:a[i-1], b:b[j-1]}); i--; j--; }
    else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { ops.push({t:'ins', b:b[j-1]}); j--; }
    else { ops.push({t:'del', a:a[i-1]}); i--; }
  }
  return ops.reverse();
}

// Pair consecutive del+ins for inline comparison — skip empty lines
function pairOps(ops) {
  const result = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i].t === 'del' && i + 1 < ops.length && ops[i + 1].t === 'ins'
        && ops[i].a !== '' && ops[i + 1].b !== '') {
      result.push({t: 'mod', a: ops[i].a, b: ops[i + 1].b});
      i += 2;
    } else {
      result.push(ops[i]);
      i++;
    }
  }
  return result;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Tokenize: CJK characters individually, ASCII words/punctuation as units, whitespace as units
function tokenize(str) {
  return str.match(/[\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF]|[^\u3000-\u9FFF\uAC00-\uD7AF\uF900-\uFAFF\s]+|\s+/g) || [];
}

// Inline diff — returns { leftHtml, rightHtml }
// Consecutive changed tokens are merged into a single <mark> for clean rendering
function inlineDiff(oldStr, newStr) {
  const tokA = oldStr === '' ? [] : tokenize(oldStr);
  const tokB = newStr === '' ? [] : tokenize(newStr);
  const ops = lcs(tokA, tokB);
  let leftHtml = '', rightHtml = '';
  let lBuf = '', rBuf = '';
  for (const op of ops) {
    if (op.t === 'eq') {
      if (lBuf) { leftHtml  += `<mark class="diff">${lBuf}</mark>`; lBuf = ''; }
      if (rBuf) { rightHtml += `<mark class="diff">${rBuf}</mark>`; rBuf = ''; }
      const s = esc(op.a);
      leftHtml += s; rightHtml += s;
    } else if (op.t === 'del') {
      lBuf += esc(op.a);
    } else {
      rBuf += esc(op.b);
    }
  }
  if (lBuf) leftHtml  += `<mark class="diff">${lBuf}</mark>`;
  if (rBuf) rightHtml += `<mark class="diff">${rBuf}</mark>`;
  return { leftHtml, rightHtml };
}

// ─── Render ────────────────────────────────────────────────────────────────

function runDiff() {
  const a = document.getElementById('text-a').value;
  const b = document.getElementById('text-b').value;

  const splitLines = s => {
    const ls = s.split('\n');
    while (ls.length && ls[ls.length - 1] === '') ls.pop();
    return ls;
  };
  const linesA = splitLines(a);
  const linesB = splitLines(b);

  const ops = pairOps(lcs(linesA, linesB));

  // Assign line numbers and compute inline diffs for modified lines
  const groups = [];
  let aNo = 1, bNo = 1;
  for (const op of ops) {
    if (op.t === 'eq') {
      groups.push({...op, aNo, bNo}); aNo++; bNo++;
    } else if (op.t === 'del') {
      if (op.a !== '') {
        const {leftHtml} = inlineDiff(op.a, '');
        groups.push({...op, aNo, bNo: null, leftHtml});
      }
      aNo++;
    } else if (op.t === 'ins') {
      if (op.b !== '') {
        const {rightHtml} = inlineDiff('', op.b);
        groups.push({...op, aNo: null, bNo, rightHtml});
      }
      bNo++;
    } else { // mod
      const {leftHtml, rightHtml} = inlineDiff(op.a, op.b);
      groups.push({...op, aNo, bNo, leftHtml, rightHtml}); aNo++; bNo++;
    }
  }

  const output = document.getElementById('output');
  output.innerHTML = renderSideBySide(groups);
}

function renderSideBySide(groups) {
  if (groups.length === 0) {
    return '<div class="placeholder" style="min-height:120px"><span>差分なし — 2つのテキストは同一です</span></div>';
  }

  const allEq = groups.every(g => g.t === 'eq');
  if (allEq) {
    return '<div class="placeholder" style="min-height:120px"><span>差分なし — 2つのテキストは同一です</span></div>';
  }

  let leftHtml = '', rightHtml = '';

  for (const op of groups) {
    if (op.t === 'eq') {
      leftHtml  += `<div class="diff-line eq"><span class="line-content">${esc(op.a)}</span></div>`;
      rightHtml += `<div class="diff-line eq"><span class="line-content">${esc(op.b)}</span></div>`;
    } else if (op.t === 'del') {
      leftHtml  += `<div class="diff-line changed"><span class="line-content">${op.leftHtml}</span></div>`;
    } else if (op.t === 'ins') {
      rightHtml += `<div class="diff-line changed"><span class="line-content">${op.rightHtml}</span></div>`;
    } else { // mod
      leftHtml  += `<div class="diff-line changed"><span class="line-content">${op.leftHtml}</span></div>`;
      rightHtml += `<div class="diff-line changed"><span class="line-content">${op.rightHtml}</span></div>`;
    }
  }

  return `
    <div class="diff-side-by-side">
      <div class="diff-col">
        ${leftHtml}
      </div>
      <div class="diff-col">
        ${rightHtml}
      </div>
    </div>`;
}

// ─── Event wiring ───────────────────────────────────────────────────────────

document.getElementById('btn-diff').addEventListener('click', runDiff);

document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runDiff();
});

document.getElementById('btn-clear').addEventListener('click', () => {
  document.getElementById('text-a').value = '';
  document.getElementById('text-b').value = '';
  document.getElementById('output').innerHTML = `
    <div class="placeholder">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
      </svg>
      <span>テキストを入力して「比較する」を押してください</span>
    </div>`;
});

document.getElementById('btn-swap').addEventListener('click', () => {
  const a = document.getElementById('text-a');
  const b = document.getElementById('text-b');
  [a.value, b.value] = [b.value, a.value];
});
