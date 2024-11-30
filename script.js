const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const annotationsTextarea = document.getElementById("annotations");
const downloadButton = document.getElementById("download-annotations");

let images = [];
let currentImageIndex = 0;
let annotations = [];
let currentBoxes = [];
let isDrawing = false;
let startX, startY;

// 全局變數
let classes = [];
let currentClass = null;
let imageFiles = [];

// 修改資料結構，為每張圖片存儲各自的標註
let imageAnnotations = {}; // 用來存儲每張圖片的標註

// Handle file selection
document.getElementById('imageInput').addEventListener('change', function(e) {
    if (!e.target.files.length) return;

    // 保存當前標註
    if (currentImageIndex !== undefined) {
        imageAnnotations[currentImageIndex] = currentBoxes;
    }

    const newFiles = Array.from(e.target.files);
    console.log('Selected files:', newFiles); // 添加調試信息

    // 過濾重複的圖片
    const uniqueNewFiles = newFiles.filter(newFile => {
        const isDuplicate = imageFiles.some(existingFile => 
            existingFile && existingFile.name === newFile.name
        );
        
        if (isDuplicate) {
            console.log(`圖片 ${newFile.name} 已經存在，將被跳過`);
            return false;
        }
        return true;
    });

    if (uniqueNewFiles.length === 0) {
        alert('所選圖片都已經在或沒有選擇新圖片！');
        this.value = '';
        return;
    }

    // 載入新圖片
    uniqueNewFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const actualIndex = images.length;
                images.push(img);
                imageFiles.push(file);
                
                console.log(`Loaded image ${file.name} at index ${actualIndex}`); // 添加調試信息
                
                // 如果這是第一張圖片，立即顯示
                if (images.length === 1) {
                    currentImageIndex = 0;
                    loadImage(0);
                }
                updateImageList();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    this.value = ''; // 清空 input
});

// Load image onto canvas
function loadImage(index) {
    if (index < 0 || index >= images.length) return;

    // 保存當前標註
    if (currentImageIndex !== undefined) {
        imageAnnotations[currentImageIndex] = [...currentBoxes];
    }

    currentImageIndex = index;
    currentBoxes = imageAnnotations[index] ? [...imageAnnotations[index]] : [];

    const img = images[index];
    if (img) {
        adjustCanvasSize();
        updateAnnotations();
        updateImageList();
    }
}

// Draw bounding boxes
function drawBoundingBoxes() {
    currentBoxes.forEach((box, index) => {
        // 找到對應的類別
        const classObj = classes.find(cls => cls.index === box.class);
        const boxColor = classObj ? classObj.color : "#ff0000";
        const label = classObj ? classObj.name : `Class ${box.class}`;
        
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([]); // 確保是實線
        
        const x = box.x * canvas.width;
        const y = box.y * canvas.height;
        const width = box.width * canvas.width;
        const height = box.height * canvas.height;
        
        // 繪製矩形框
        ctx.strokeRect(x, y, width, height);
        
        // 繪製標籤背景
        ctx.font = '14px Arial';
        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width;
        const textHeight = 20; // 固定高度
        const padding = 4; // 文字周圍的內邊距
        
        // 確保標籤不會超出畫布上方
        const labelY = y + textHeight;
        
        // 繪製標籤背景
        ctx.fillStyle = boxColor;
        ctx.fillRect(
            x - 1, // 稍微向左偏移以對齊邊框
            labelY - textHeight,
            textWidth + (padding * 2),
            textHeight
        );
        
        // 繪製標籤文字
        ctx.fillStyle = 'white';
        ctx.fillText(
            label,
            x + padding,
            labelY - 6 // 微調以使文字垂直置中
        );
        
        // 添加刪除按鈕
        const btnSize = 20;
        const btnX = x + width;
        const btnY = y;
        
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(btnX, btnY, btnSize/2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(btnX - 5, btnY - 5);
        ctx.lineTo(btnX + 5, btnY + 5);
        ctx.moveTo(btnX + 5, btnY - 5);
        ctx.lineTo(btnX - 5, btnY + 5);
        ctx.stroke();

        // 更新刪除按鈕的點擊區域
        const deleteButtonPath = new Path2D();
        deleteButtonPath.arc(btnX, btnY, btnSize/2, 0, Math.PI * 2);
        box.deleteButtonPath = deleteButtonPath;
    });
}

// Mouse events for drawing bounding boxes
canvas.addEventListener("mousedown", (event) => {
    if (currentImageIndex === undefined || !images[currentImageIndex]) {
        alert('請先選擇一張圖片！');
        return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (event.clientX - rect.left) * scaleX;
    const clickY = (event.clientY - rect.top) * scaleY;

    // 檢查是否點擊到刪除按鈕
    let clickedDelete = false;
    currentBoxes.forEach(box => {
        if (box.deleteButtonPath && ctx.isPointInPath(box.deleteButtonPath, clickX, clickY)) {
            clickedDelete = true;
        }
    });

    if (!clickedDelete) {
        if (!currentClass) {
            alert('請先選擇一個類別！');
            return;
        }
        isDrawing = true;
        startX = clickX;
        startY = clickY;
    }
});

canvas.addEventListener("mousemove", (event) => {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const currentX = (event.clientX - rect.left) * scaleX;
    const currentY = (event.clientY - rect.top) * scaleY;
    
    // 重繪畫布
    const img = images[currentImageIndex];
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    drawBoundingBoxes();
    
    // 繪製虛線框
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = currentClass ? currentClass.color : "#ff0000";
    ctx.lineWidth = 2;
    
    // 計算框的座標和大小
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const width = Math.abs(startX - currentX);
    const height = Math.abs(startY - currentY);
    
    // 繪製虛線框
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);
});

canvas.addEventListener("mouseup", (event) => {
    if (!isDrawing) return;
    isDrawing = false;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const currentX = (event.clientX - rect.left) * scaleX;
    const currentY = (event.clientY - rect.top) * scaleY;

    // 計算標註框的座標和大小（相對於畫布的比例）
    const x = Math.min(startX, currentX) / canvas.width;
    const y = Math.min(startY, currentY) / canvas.height;
    const width = Math.abs(startX - currentX) / canvas.width;
    const height = Math.abs(startY - currentY) / canvas.height;

    // 只有當框有實際大小時才添加
    if (width > 0 && height > 0) {
        const classIndex = currentClass ? currentClass.index : 0;
        const newBox = { class: classIndex, x, y, width, height };
        currentBoxes.push(newBox);
        
        // 重繪畫布
        drawBoundingBoxes();
        
        // 更新文字方塊
        updateAnnotations();
        
        // 保存到當前圖片的標註
        if (currentImageIndex !== undefined) {
            imageAnnotations[currentImageIndex] = [...currentBoxes];
        }
    }
});

// Update annotations textarea
function updateAnnotations() {
    if (!annotationsTextarea) return;
    
    const annotations = currentBoxes.map(box => {
        return `${box.class} ${box.x.toFixed(6)} ${box.y.toFixed(6)} ${box.width.toFixed(6)} ${box.height.toFixed(6)}`;
    });
    
    annotationsTextarea.value = annotations.join('\n');
}

// Download annotations as a text file
downloadButton.addEventListener("click", () => {
    // 保存當前圖片的標註
    imageAnnotations[currentImageIndex] = currentBoxes;

    // 為每個檔案創建一個下載
    imageFiles.forEach((file, index) => {
        const annotations = imageAnnotations[index] || [];
        if (annotations.length === 0) return;

        const annotationText = annotations.map(box => {
            return `${box.class} ${box.x.toFixed(6)} ${box.y.toFixed(6)} ${box.width.toFixed(6)} ${box.height.toFixed(6)}`;
        }).join("\n");

        const blob = new Blob([annotationText], { type: "text/plain" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        
        // 使用圖片檔名作為標註檔名
        const fileName = file.name.replace(/\.[^/.]+$/, ""); // 移除副檔名
        link.download = `${fileName}.txt`;
        
        // 延遲下載避免瀏覽器阻擋
        setTimeout(() => {
            link.click();
            URL.revokeObjectURL(link.href);
        }, index * 100);
    });
});

// 修改類別管理相關函數
function showAddClassDialog() {
    document.getElementById('addClassDialog').style.display = 'block';
    document.getElementById('newClassName').value = '';
    document.getElementById('newClassColor').value = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
}

function closeAddClassDialog() {
    document.getElementById('addClassDialog').style.display = 'none';
}

function addClassConfirm() {
    const name = document.getElementById('newClassName').value;
    const color = document.getElementById('newClassColor').value;
    
    if (name) {
        // 檢查類別名稱是否已存在
        const existingClass = classes.find(cls => cls.name === name);
        if (existingClass) {
            alert('類別名稱已存在！');
            return;
        }

        // 找出目前最大的類別索引
        const maxIndex = classes.reduce((max, cls) => {
            return Math.max(max, cls.index || 0);
        }, -1);

        // 添加新類別，使用最大索引 + 1
        classes.push({ 
            name: name, 
            color: color,
            index: maxIndex + 1
        });

        updateClassList();
        closeAddClassDialog();
    }
}

// 修改類別列表更新數
function updateClassList() {
    const classList = document.querySelector('.right-panel .class-list');
    if (!classList) {
        console.error('Class list element not found');
        return;
    }

    classList.innerHTML = '';
    classes.forEach((cls, index) => {
        const div = document.createElement('div');
        div.className = 'class-item';
        
        // 如果只有一個類別或當前類別被選中，添加選中樣式
        if (currentClass === cls || (classes.length === 1 && !currentClass)) {
            div.classList.add('selected');
            div.style.backgroundColor = '#e3f2fd';
            div.style.borderLeft = '4px solid #1976d2';
            // 如果只有一個類別且尚未選中，自動選中它
            if (classes.length === 1 && !currentClass) {
                currentClass = cls;
            }
        }

        div.innerHTML = `
            <div class="class-actions">
                <button class="action-btn delete-btn" onclick="removeClass(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <input type="color" value="${cls.color}" 
                onchange="updateClassColor(${index}, this.value)"
                class="color-picker">
            <div class="class-info">
                <span class="class-name" title="${cls.name}">${cls.name}</span>
            </div>
        `;
        
        div.addEventListener('click', (e) => {
            if (!e.target.closest('.color-picker') && !e.target.closest('.delete-btn')) {
                selectClass(index);
            }
        });
        classList.appendChild(div);
    });
}

// 選擇類別
function selectClass(index) {
    currentClass = classes[index];
    
    // 新所有類別項目的式
    document.querySelectorAll('.class-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('selected');
            item.style.backgroundColor = '#e3f2fd';
            item.style.borderLeft = '4px solid #1976d2';
        } else {
            item.classList.remove('selected');
            item.style.backgroundColor = 'white';
            item.style.borderLeft = 'none';
        }
    });
}

// 修改刪除類別函數
function removeClass(index) {
    const removedClass = classes[index];
    
    // 刪除所有圖片中使用該類別的標註
    Object.keys(imageAnnotations).forEach(imageIndex => {
        const annotations = imageAnnotations[imageIndex];
        if (annotations) {
            // 移除使用被刪除類別的標註
            imageAnnotations[imageIndex] = annotations.filter(box => 
                box.class !== removedClass.index
            );
        }
    });

    // 更新當前圖片的標註
    currentBoxes = currentBoxes.filter(box => 
        box.class !== removedClass.index
    );

    // 刪除類別
    classes.splice(index, 1);
    
    // 如果刪除的是當前選中的類別
    if (currentClass && currentClass === removedClass) {
        currentClass = null;
    }

    // 更新顯示
    updateClassList();
    if (images[currentImageIndex]) {
        ctx.drawImage(images[currentImageIndex], 0, 0, canvas.width, canvas.height);
        drawBoundingBoxes();
    }
    updateAnnotations();
}

// 添加更新類別顏色的函數
function updateClassColor(index, newColor) {
    classes[index].color = newColor;
    
    // 更新所有圖片的標註顏色
    Object.keys(imageAnnotations).forEach(imageIndex => {
        const annotations = imageAnnotations[imageIndex];
        if (annotations) {
            annotations.forEach(box => {
                if (box.class === index) {
                    box.color = newColor;
                }
            });
        }
    });

    // 如果是當前圖片，重新繪製
    if (images[currentImageIndex]) {
        ctx.drawImage(images[currentImageIndex], 0, 0, canvas.width, canvas.height);
        drawBoundingBoxes();
    }
}

// 添加按鈕點擊事件
document.getElementById('addImagesBtn').addEventListener('click', function() {
    document.getElementById('imageInput').click();
});

// 修改更新圖片列表顯示函數
function updateImageList() {
    const imageList = document.getElementById('imageList');
    imageList.innerHTML = '';
    
    imageFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'image-item';
        if (index === currentImageIndex) {
            div.classList.add('selected');
        }
        
        div.innerHTML = `
            <div class="image-actions">
                <button class="action-btn delete-btn" onclick="deleteImage(${index})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="image-info">
                <span class="image-name" title="${file.name}">${file.name}</span>
            </div>
        `;

        div.addEventListener('click', (e) => {
            if (!e.target.closest('.delete-btn')) {
                loadImage(index);
            }
        });

        imageList.appendChild(div);
    });
}

// 修改檔案刪除函數
function deleteImage(index) {
    if (index < 0 || index >= images.length) return;

    // 如果刪除當前圖片，先切換到其他圖片
    if (index === currentImageIndex) {
        const newIndex = index === images.length - 1 ? index - 1 : index + 1;
        if (newIndex >= 0) {
            loadImage(newIndex);
        } else {
            currentImageIndex = undefined;
            currentBoxes = [];
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }

    // 刪除圖片相關資料
    images.splice(index, 1);
    imageFiles.splice(index, 1);
    
    // 重新組織標註資料
    const newAnnotations = {};
    Object.keys(imageAnnotations).forEach(key => {
        const keyNum = parseInt(key);
        if (keyNum < index) {
            newAnnotations[keyNum] = imageAnnotations[keyNum];
        } else if (keyNum > index) {
            newAnnotations[keyNum - 1] = imageAnnotations[keyNum];
        }
    });
    imageAnnotations = newAnnotations;

    updateImageList();
}

// 添加下載類別檔案的功能
document.getElementById('download-classes').addEventListener("click", () => {
    const classesText = classes.map((cls, index) => `${index} ${cls.name}`).join("\n");
    const blob = new Blob([classesText], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "classes.txt";
    link.click();
    URL.revokeObjectURL(link.href);
});

// 添加滑鼠移動事件來改變游標樣式
canvas.addEventListener("mousemove", (event) => {
    if (isDrawing) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // 檢查是否在任何刪除按鈕上
    let onDeleteButton = false;
    currentBoxes.forEach(box => {
        if (box.deleteButtonPath && ctx.isPointInPath(box.deleteButtonPath, mouseX, mouseY)) {
            onDeleteButton = true;
        }
    });

    // 根據位置改變游標樣式
    canvas.style.cursor = onDeleteButton ? 'pointer' : 'crosshair';
});

// 綁定添加類別按鈕事件
document.addEventListener('DOMContentLoaded', function() {
    const addClassBtn = document.getElementById('addClassBtn');
    if (addClassBtn) {
        addClassBtn.addEventListener('click', showAddClassDialog);
    } else {
        console.error('Add class button not found');
    }
});

// 修改圖片容器樣式
// const style = document.createElement('style');
// style.textContent = `
//     #image-container {
//         flex: 1;
//         display: flex;
//         justify-content: center;
//         align-items: center;
//         overflow: auto;  /* 改為可捲動 */
//         padding: 20px;
//         background: #f5f5f5;
//         border-radius: 8px;
//     }

//     #canvas {
//         background: white;
//         box-shadow: 0 2px 4px rgba(0,0,0,0.1);
//     }
// `;
// document.head.appendChild(style);

// 添加下載所有標註的功
document.getElementById('download-all-annotations').addEventListener("click", () => {
    // 保存當前圖片的標註
    if (currentImageIndex !== undefined) {
        imageAnnotations[currentImageIndex] = [...currentBoxes];
    }

    // 創一個 zip 件
    const zip = new JSZip();

    // 為每個圖片創建標註文件
    imageFiles.forEach((file, index) => {
        const annotations = imageAnnotations[index] || [];
        if (annotations.length > 0) {
            const annotationText = annotations.map(box => {
                return `${box.class} ${box.x.toFixed(6)} ${box.y.toFixed(6)} ${box.width.toFixed(6)} ${box.height.toFixed(6)}`;
            }).join("\n");

            // 使用圖片檔名作為標註檔名
            const fileName = file.name.replace(/\.[^/.]+$/, ""); // 移除副檔名
            zip.file(`${fileName}.txt`, annotationText);
        }
    });

    // 生成並下載 zip 文件
    zip.generateAsync({type: "blob"}).then(function(content) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(content);
        link.download = "annotations.zip";
        link.click();
        URL.revokeObjectURL(link.href);
    });
});

// 修改標註文本區域的樣
const textareaStyle = document.createElement('style');
textareaStyle.textContent = `
    #annotations {
        width: 100%;
        flex: 1;
        min-height: 200px;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-family: monospace;
        resize: none;
        white-space: pre;           /* 使用 pre 格式保持換行和空格 */
        overflow-x: auto;           /* 允許水平捲動 */
        overflow-y: auto;           /* 允許垂直捲動 */
        font-size: 14px;            /* 設定合適的字體大小 */
        line-height: 1.5;           /* 設定行高 */
        tab-size: 4;                /* 設定 tab 的寬度 */
    }
`;
document.head.appendChild(textareaStyle);

// 添加匯入標註功能
document.getElementById('import-annotations').addEventListener('click', () => {
    document.getElementById('import-input').click();
});

document.getElementById('import-input').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // 檢查是否為 zip 檔
    if (files[0].name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(files[0]);
        
        // 處理 zip 中的檔案
        for (let filename in zip.files) {
            if (filename.endsWith('.txt')) {
                const content = await zip.files[filename].async('text');
                const imageName = filename.replace('.txt', '');
                
                // 尋找對應的圖片
                const imageIndex = imageFiles.findIndex(file => 
                    file.name.replace(/\.[^/.]+$/, '') === imageName
                );

                if (imageIndex !== -1) {
                    // 解析標註內容
                    const annotations = content.split('\n')
                        .filter(line => line.trim())
                        .map(line => {
                            const [classId, x, y, width, height] = line.split(' ').map(Number);
                            return { class: classId, x, y, width, height };
                        });
                    
                    imageAnnotations[imageIndex] = annotations;
                }
            }
        }
    } else {
        // 處理單個 txt 檔
        for (let file of files) {
            if (!file.name.endsWith('.txt')) continue;

            const content = await file.text();
            const imageName = file.name.replace('.txt', '');
            
            // 尋找對應的圖片
            const imageIndex = imageFiles.findIndex(file => 
                file.name.replace(/\.[^/.]+$/, '') === imageName
            );

            if (imageIndex !== -1) {
                // 解析標註內容
                const annotations = content.split('\n')
                    .filter(line => line.trim())
                    .map(line => {
                        const [classId, x, y, width, height] = line.split(' ').map(Number);
                        return { class: classId, x, y, width, height };
                    });
                
                imageAnnotations[imageIndex] = annotations;
            }
        }
    }

    // 更新當前圖片的顯示
    if (currentImageIndex !== undefined) {
        currentBoxes = imageAnnotations[currentImageIndex] || [];
        drawBoundingBoxes();
        updateAnnotations();
    }

    e.target.value = ''; // 清空輸入
    alert('標註匯入完成');
});

// 生成隨機顏色函數
function generateRandomColor() {
    const hue = Math.random() * 360;
    const saturation = 70 + Math.random() * 30; // 70-100%
    const lightness = 35 + Math.random() * 15;  // 35-50%
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// 添加匯入類別功能
document.getElementById('import-classes').addEventListener('click', () => {
    document.getElementById('import-classes-input').click();
});

document.getElementById('import-classes-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const content = await file.text();
        const newClasses = [];
        const usedColors = new Set(classes.map(cls => cls.color));
        
        // 解析類別檔案
        content.split('\n').forEach(line => {
            line = line.trim();
            if (!line) return;
            
            const [id, name] = line.split(' ');
            if (name) {
                // 生成不重複的顏色
                let color;
                do {
                    color = generateRandomColor();
                } while (usedColors.has(color));
                usedColors.add(color);

                newClasses[parseInt(id)] = {
                    name: name,
                    color: color
                };
            }
        });

        // 過濾掉空值並更新類別陣列
        classes = newClasses.filter(cls => cls);

        // 更新面
        updateClassList();
        
        // 如果有圖片正在示，重新繪製標註
        if (currentImageIndex !== undefined && images[currentImageIndex]) {
            ctx.drawImage(images[currentImageIndex], 0, 0, canvas.width, canvas.height);
            drawBoundingBoxes();
        }

        alert('類別匯入完成');
    } catch (error) {
        console.error('Error importing classes:', error);
        alert('匯入類別時發生錯誤');
    }

    e.target.value = ''; // 清空輸入
});

// 添加新的樣式
const buttonStyle = document.createElement('style');
buttonStyle.textContent = `
    .action-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        padding: 0;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        color: white;
        transition: all 0.2s ease;
    }

    .action-btn i {
        font-size: 14px;
    }

    .load-btn:hover {
        background-color: #1976D2;
    }

    .delete-btn:hover {
        background-color: #d32f2f;
    }

    .edit-btn:hover {
        background-color: #388E3C;
    }

    .class-actions, .image-actions {
        display: flex;
        gap: 6px;
        align-items: center;
    }
`;
document.head.appendChild(buttonStyle);

// 面板切換功能
document.addEventListener('DOMContentLoaded', function() {
    const leftPanel = document.querySelector('.left-panel');
    const rightPanel = document.querySelector('.right-panel');
    const leftToggle = document.querySelector('.left-toggle');
    const rightToggle = document.querySelector('.right-toggle');
    const overlay = document.querySelector('.overlay');

    // 修改左側面板切換
    leftToggle.addEventListener('click', () => {
        leftPanel.classList.toggle('collapsed');
        setTimeout(adjustCanvasSize, 300); // 等待過渡動畫完成
    });

    // 修改右側面板切換
    rightToggle.addEventListener('click', () => {
        rightPanel.classList.toggle('collapsed');
        setTimeout(adjustCanvasSize, 300); // 等待過渡動畫完成
    });

});

// 修改 adjustCanvasSize 函數
function adjustCanvasSize() {
    if (!images[currentImageIndex]) return;

    const img = images[currentImageIndex];
    const container = document.getElementById('image-container');
    
    // 設算容器的可用空間
    const containerWidth = container.clientWidth - 40;  // 減去 padding
    const containerHeight = container.clientHeight - 40;
    
    // 計算圖片應該的大小，保持比例
    const imageRatio = img.width / img.height;
    const containerRatio = containerWidth / containerHeight;
    
    let width, height;
    
    if (imageRatio > containerRatio) {
        // 圖片較寬，以寬度為基準
        width = containerWidth;
        height = containerWidth / imageRatio;
    } else {
        // 圖片較高，以高度為基準
        height = containerHeight;
        width = containerHeight * imageRatio;
    }
    
    // 設定畫布大小
    canvas.width = width;
    canvas.height = height;
    
    // 清並重繪
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    drawBoundingBoxes();
}

// 修改圖片容器的樣式
// const containerStyle = document.createElement('style');
// containerStyle.textContent = `
//     #image-container {
//         flex: 1;
//         display: flex;
//         justify-content: center;
//         align-items: center;
//         padding: 20px;
//         background: #f5f5f5;
//         border-radius: 8px;
//         position: relative;
//         overflow: hidden;  /* 防止內容溢出 */
//     }

//     #canvas {
//         background: white;
//         box-shadow: 0 2px 4px rgba(0,0,0,0.1);
//     }

//     .center-panel {
//         display: flex;
//         flex-direction: column;
//         flex: 1;
//         overflow: hidden;
//         position: relative;
//     }
// `;
// document.head.appendChild(containerStyle);

// 添加視窗大小改變時的處理
window.addEventListener('resize', () => {
    if (currentImageIndex !== undefined) {
        adjustCanvasSize();
    }
});

// 修改 canvas 的點擊事件處理
canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (event.clientX - rect.left) * scaleX;
    const clickY = (event.clientY - rect.top) * scaleY;

    if (Math.abs(clickX-startX) > 50 && Math.abs(clickY-startY) > 50) return;
    // alert(clickX + "\n" + clickY + "\n" + startX + "\n" + startY);
    
    // 檢查是否點擊到刪除按鈕
    currentBoxes.forEach((box, index) => {
        if (box.deleteButtonPath && ctx.isPointInPath(box.deleteButtonPath, clickX, clickY)) {
            // 刪除標註
            currentBoxes.splice(index, 1);
            // 重繪畫布
            const img = images[currentImageIndex];
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            drawBoundingBoxes();
            updateAnnotations();
            
            // 防止事件冒泡和開始新的標註
            event.stopPropagation();
            isDrawing = false;
        }
    });
});

// 更新圖片項目的樣式
// const imageItemStyle = document.createElement('style');
// imageItemStyle.textContent = `
//     .image-item {
//         display: flex;
//         justify-content: space-between;
//         align-items: center;
//         padding: 12px;
//         margin: 5px 0;
//         background: white;
//         border-radius: 4px;
//         cursor: pointer;
//         transition: all 0.2s ease;
//     }

//     .image-item:hover {
//         background: #f5f5f5;
//     }

//     .image-item.selected {
//         background: #e3f2fd;
//         border-left: 4px solid #1976d2;
//     }

//     .image-info {
//         display: flex;
//         align-items: center;
//         flex: 1;
//         overflow: hidden;
//     }

//     .image-name {
//         overflow: hidden;
//         text-overflow: ellipsis;
//         white-space: nowrap;
//     }

//     .image-actions {
//         display: flex;
//         gap: 6px;
//     }
// `;
// document.head.appendChild(imageItemStyle);
