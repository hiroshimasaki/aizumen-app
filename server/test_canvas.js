const canvas = require('canvas');
const fs = require('fs');

async function testCanvas() {
    console.log('Testing simple canvas draw...');
    const c = canvas.createCanvas(100, 100);
    const ctx = c.getContext('2d');
    
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 100, 100);
    
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(90, 90);
    ctx.stroke();
    
    const buf = c.toBuffer('image/png');
    console.log(`PNG size: ${buf.length} bytes`);
    fs.writeFileSync('test_canvas_basic.png', buf);
}

testCanvas();
