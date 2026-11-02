const fs = require('fs');
const content = fs.readFileSync('src/screens/SchoolAdminDashboardScreen.tsx', 'utf8');

const newFunc = `  const handleClearTeacherActivity = async () => {
    if (confirm('Are you sure you want to permanently clear all recent teacher activity records?')) {
      const success = await CloudSync.clearSchoolActivities(admin.schoolCode);
      if (success) {
        setRealtimeActivities([]);
        showToast('All teacher activities have been permanently deleted.');
      } else {
        showToast('Failed to clear teacher activities. Please try again.');
      }
    }
  };

  const handleExportFullJson = () => {`;

const newContent = content.replace('  const handleExportFullJson = () => {', newFunc);
fs.writeFileSync('src/screens/SchoolAdminDashboardScreen.tsx', newContent);
console.log('Patched handleClearTeacherActivity');
