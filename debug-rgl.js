const RGL = require('react-grid-layout');
console.log('Type of RGL:', typeof RGL);
console.log('RGL keys:', Object.keys(RGL));
if (RGL.default) {
    console.log('RGL.default keys:', Object.keys(RGL.default));
}
console.log('WidthProvider on RGL:', !!RGL.WidthProvider);
console.log('WidthProvider on RGL.default:', RGL.default ? !!RGL.default.WidthProvider : 'N/A');
