const fs = require('fs');
let content = fs.readFileSync('src/screens/SchoolAdminDashboardScreen.tsx', 'utf8');

const targetState = `  const [realtimeActivities, setRealtimeActivities] = useState<TeacherActivityItem[]>([]);`;
const newState = targetState + `\n  const [teacherSignups, setTeacherSignups] = useState<any[]>([]);`;
content = content.replace(targetState, newState);

const targetEffect = `    // 3. Subscribe to real-time teacher activities for this school code from Firestore
    const unsubActivities = CloudSync.listenToSchoolActivities(activeSchoolCode, (activities) => {
      setRealtimeActivities(activities);
    });

    return () => {
      unsubTeachers();
      unsubClasses();
      unsubActivities();
    };
  }, [activeSchoolCode, admin, refreshTrigger]);`;

const newEffect = `    // 3. Subscribe to real-time teacher activities for this school code from Firestore
    const unsubActivities = CloudSync.listenToSchoolActivities(activeSchoolCode, (activities) => {
      setRealtimeActivities(activities);
    });

    // 4. Fetch teacherSignups
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
    };
  }, [activeSchoolCode, admin, refreshTrigger]);`;

content = content.replace(targetEffect, newEffect);
fs.writeFileSync('src/screens/SchoolAdminDashboardScreen.tsx', content);
console.log('Patched Admin State');
