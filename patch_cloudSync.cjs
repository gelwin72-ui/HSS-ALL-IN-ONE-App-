const fs = require('fs');
const content = fs.readFileSync('src/utils/cloudSync.ts', 'utf8');

const newFunc = `  public async clearSchoolActivities(schoolCode: string): Promise<boolean> {
    if (!schoolCode) return false;
    const cleanCode = schoolCode.trim().toUpperCase();
    try {
      const activitiesRefPath = ref(database, \`schools/\${cleanCode}/activities\`);
      await remove(activitiesRefPath);
      return true;
    } catch (e) {
      console.error('Error clearing school activities:', e);
      return false;
    }
  }

  public listenToSchoolActivities(`;

if (content.includes('clearSchoolActivities')) {
  console.log('Already patched');
} else {
  const newContent = content.replace('  public listenToSchoolActivities(', newFunc);
  fs.writeFileSync('src/utils/cloudSync.ts', newContent);
  console.log('Patched');
}
