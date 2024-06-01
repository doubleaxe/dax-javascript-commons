const fs = require('node:fs');
const path = require('node:path');

const fileName = process.argv[2];

const json = JSON.parse(fs.readFileSync(fileName, 'utf8'));
const rules = json.rules;
delete json.rules;

const isDisabled = (rule) => {
    if (rule === 'off' || rule === 0) return true;
    if (Array.isArray(rule) && isDisabled(rule[0])) return true;
    return false;
};
const fixError = (rule) => {
    if (rule === 'error' || rule === 2) return 'error';
    if (rule === 'warn' || rule === 1) return 'warn';
    if (Array.isArray(rule)) return [fixError(rule[0]), ...rule.slice(1)];
    return rule;
};
const processedRules = Object.fromEntries(
    Object.entries(rules)
        .filter(([, value]) => !isDisabled(value))
        .map(([key, value]) => [key, fixError(value)])
        .sort(([key1], [key2]) => key1.localeCompare(key2))
);

const dir = path.dirname(fileName);
const ext = path.extname(fileName);
const name = path.basename(fileName, ext);

fs.writeFileSync(dir + '/' + name + '-rules.json', JSON.stringify(processedRules, null, 2));
fs.writeFileSync(dir + '/' + name + '-config.json', JSON.stringify(json, null, 2));
