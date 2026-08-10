const fs = require('fs');
const dataContent = fs.readFileSync('data.js', 'utf8');
eval(dataContent);
let baseData = [];
if (typeof feedbackData !== 'undefined' && Array.isArray(feedbackData)) {
  for (let i = 0; i < feedbackData.length; i++) {
    let item = feedbackData[i];
    try {
      baseData.push({
        id: 'base-' + i,
        path: item.path,
        category: item.category,
        filename: item.filename || item.path.split('/').pop(),
        isBase: true
      });
    } catch (e) {
      console.log('Error at index ' + i + ': ' + e.message);
    }
  }
}
console.log('baseData length: ' + baseData.length);
