const fs = require('fs');
let content = fs.readFileSync('src/screens/AuthScreen.tsx', 'utf8');

const targetWrite = `          await set(schoolTeacherRef, {
            id: firebaseUid,
            uid: firebaseUid,
            name: signupName.trim(),
            email: cleanEmail,
            gmail: cleanEmail,
            phone: signupPhone.trim(),
            schoolName: signupSchool.trim(),
            schoolCode: cleanSchoolCode,
            subject: effectiveSubject,
            designation: signupDesignation.trim() || \`\${effectiveSubject} Teacher\`,
            role: 'teacher',
            active: true,
            createdAt: new Date().toISOString()
          });`;

const newWrite = targetWrite + `\n
          const teacherSignupsRef = ref(database, \`teacherSignups/\${firebaseUid}\`);
          await set(teacherSignupsRef, {
            fullName: signupName.trim(),
            email: cleanEmail,
            dateOfBirth: signupDob,
            mobileNumber: signupPhone.trim(),
            schoolOrCollegeName: signupSchool.trim(),
            schoolCode: cleanSchoolCode,
            subject: effectiveSubject,
            isClassTeacher: signupIsClassTeacher,
            className: signupIsClassTeacher ? effectiveStandard : '',
            stream: signupIsClassTeacher ? effectiveStream : '',
            section: signupIsClassTeacher ? signupSection : '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });`;

content = content.replace(targetWrite, newWrite);
fs.writeFileSync('src/screens/AuthScreen.tsx', content);
console.log('Patched AuthScreen RTDB write');
