const fs = require('fs');
const content = fs.readFileSync('src/screens/AuthScreen.tsx', 'utf8');

const targetState = `  const [signupSection, setSignupSection] = useState('A');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupDob, setSignupDob] = useState('');`;

const newState = targetState + `\n  const [signupIsClassTeacher, setSignupIsClassTeacher] = useState(true);`;

const newContent = content.replace(targetState, newState);
fs.writeFileSync('src/screens/AuthScreen.tsx', newContent);
console.log('Patched AuthScreen state');
