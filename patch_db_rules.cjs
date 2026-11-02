const fs = require('fs');
const rules = JSON.parse(fs.readFileSync('database.rules.json', 'utf8'));

rules.rules.teacherSignups = {
  ".read": "auth != null",
  "$uid": {
    ".read": "auth != null && auth.uid == $uid",
    ".write": "auth != null && auth.uid == $uid"
  }
};

rules.rules.teachers = {
  ".read": "auth != null",
  ".write": "auth != null"
};

fs.writeFileSync('database.rules.json', JSON.stringify(rules, null, 2));
console.log('Patched database.rules.json');
