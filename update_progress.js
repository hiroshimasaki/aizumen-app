const fs = require('fs');
const path = 'c:\\Users\\正木鉄工\\OneDrive\\デスクトップ\\dev\\AiZumen\\docs\\task_progress.md';
let text = fs.readFileSync(path, 'utf8');
const p1Start = text.indexOf('## Phase 1:');
const p3Start = text.indexOf('## Phase 3:');
if (p1Start !== -1 && p3Start !== -1) {
    let section = text.substring(p1Start, p3Start);
    section = section.replace(/- \[ \]/g, '- [x]');
    text = text.substring(0, p1Start) + section + text.substring(p3Start);

    // Overall progress update
    text = text.replace('██░░░░░░░░ 5%', '████████░░ 60%');

    fs.writeFileSync(path, text, 'utf8');
    console.log("task_progress.md updated");
}
