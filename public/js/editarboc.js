const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const fileInput = document.getElementById('fileInput');
const history = [];
const redoStack = [];
let isDrawing = false;
let lastX = 0, lastY = 0;

// Subir Imagen
document.getElementById('upload').addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
        saveHistory();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
    };
    reader.readAsDataURL(file);
    }
});

// Dibujar
document.getElementById('draw').addEventListener('click', () => {
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
});

function startDrawing(e) {
    saveHistory();
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
}

function draw(e) {
    if (!isDrawing) return;
    ctx.strokeStyle = '#000'; // Color negro
    ctx.lineWidth = 2; // Grosor fijo
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    [lastX, lastY] = [e.offsetX, e.offsetY];
}

function stopDrawing() {
    isDrawing = false;
    ctx.beginPath();
}

// Voltear Imagen
document.getElementById('flip').addEventListener('click', () => {
    saveHistory();
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(canvas, 0, 0);
    ctx.restore();
});

// Deshacer
document.getElementById('undo').addEventListener('click', () => {
    if (history.length > 0) {
    const lastState = history.pop();
    redoStack.push(canvas.toDataURL());
    restoreState(lastState);
    }
});

// Rehacer
document.getElementById('redo').addEventListener('click', () => {
    if (redoStack.length > 0) {
    const nextState = redoStack.pop();
    saveHistory();
    restoreState(nextState);
    }
});

function restoreState(state) {
    const img = new Image();
    img.src = state;
    img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    };
}

function saveHistory() {
    history.push(canvas.toDataURL());
    redoStack.length = 0; // Limpiar pila de rehacer al guardar nuevo estado
}

// Descargar
document.getElementById('download').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = 'boceto-editado.png';
    link.href = canvas.toDataURL();
    link.click();
});