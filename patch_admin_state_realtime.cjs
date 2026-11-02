const fs = require('fs');
let content = fs.readFileSync('src/screens/SchoolAdminDashboardScreen.tsx', 'utf8');

const targetEffect = `    // 4. Fetch teacherSignups
    import('firebase/database').then(({ getDatabase, ref, get, query, orderByChild, equalTo }) => {
      const db = getDatabase();
      const signupsRef = query(ref(db, 'teacherSignups'), orderByChild('schoolCode'), equalTo(activeSchoolCode));
      get(signupsRef).then(snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const list = Object.keys(data).map(k => ({ uid: k, ...data[k] }));
          setTeacherSignups(list);
        }
      }).catch(e => console.error('Error fetching teacher signups', e));
    });

    return () => {
      unsubTeachers();
      unsubClasses();
      unsubActivities();
    };`;

const newEffect = `    // 4. Fetch teacherSignups in realtime
    let unsubSignups = () => {};
    import('firebase/database').then(({ getDatabase, ref, query, orderByChild, equalTo, onValue }) => {
      const db = getDatabase();
      const signupsRef = query(ref(db, 'teacherSignups'), orderByChild('schoolCode'), equalTo(activeSchoolCode));
      unsubSignups = onValue(signupsRef, snapshot => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          const list = Object.keys(data).map(k => ({ uid: k, ...data[k] }));
          setTeacherSignups(list);
        } else {
          setTeacherSignups([]);
        }
      });
    }).catch(e => console.error('Error listening to teacher signups', e));

    return () => {
      unsubTeachers();
      unsubClasses();
      unsubActivities();
      unsubSignups();
    };`;

content = content.replace(targetEffect, newEffect);
fs.writeFileSync('src/screens/SchoolAdminDashboardScreen.tsx', content);
console.log('Patched Admin State Realtime');
