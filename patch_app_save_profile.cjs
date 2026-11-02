const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetStr = `  // 1. School Profile Handler
  const handleSaveProfile = (
    newSchool: SchoolProfile,
    newClass: ClassInfo,
    newTeacher: TeacherInfo
  ) => {
    StorageService.saveSchoolProfile(newSchool);
    StorageService.saveClassInfo(newClass, activeClassId);
    StorageService.saveTeacherInfo(newTeacher);

    setSchool(newSchool);
    setClassInfo(newClass);
    setTeacher(newTeacher);
    setClassesList(StorageService.getClassesList());

    showToast('School & Class Profile updated successfully!', 'success');
  };`;

const newStr = `  // 1. School Profile Handler
  const handleSaveProfile = async (
    newSchool: SchoolProfile,
    newClass: ClassInfo,
    newTeacher: TeacherInfo
  ) => {
    StorageService.saveSchoolProfile(newSchool);
    StorageService.saveClassInfo(newClass, activeClassId);
    StorageService.saveTeacherInfo(newTeacher);

    setSchool(newSchool);
    setClassInfo(newClass);
    setTeacher(newTeacher);
    setClassesList(StorageService.getClassesList());

    // Update teacherSignups in RTDB
    const currentSession = StorageService.getAuthSession();
    const t = currentSession.currentTeacher;
    if (t && t.uid) {
      try {
        const { getDatabase, ref, update } = await import('firebase/database');
        const db = getDatabase();
        await update(ref(db, \`teacherSignups/\${t.uid}\`), {
          fullName: newTeacher.teacherName,
          email: newTeacher.email || t.email,
          dateOfBirth: newTeacher.dob || '',
          mobileNumber: newTeacher.phone || '',
          schoolOrCollegeName: newSchool.schoolName || '',
          schoolCode: newSchool.schoolCode || '',
          subject: newTeacher.designation || '',
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Failed to update teacherSignups in RTDB:', err);
      }
    }

    showToast('School & Class Profile updated successfully!', 'success');
  };`;

content = content.replace(targetStr, newStr);
fs.writeFileSync('src/App.tsx', content);
console.log('Patched App.tsx handleSaveProfile');
