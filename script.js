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

// 在全局變數區域添加
let isDash = false;

// 添加全局變數
let showClassId = false; // 預設顯示類別名稱

// Handle file selection
document.getElementById('imageInput').addEventListener('change', async function(e) {
    if (!e.target.files.length) return;

    // 保存當前標註
    if (currentImageIndex !== undefined) {
        imageAnnotations[currentImageIndex] = [...currentBoxes];
    }

    const newFiles = Array.from(e.target.files);
    console.log('Selected files:', newFiles);

    // 過濾重複的圖片並排序
    const uniqueNewFiles = newFiles
        .filter(newFile => {
            const isDuplicate = imageFiles.some(existingFile => 
                existingFile && existingFile.name === newFile.name
            );
            
            if (isDuplicate) {
                console.log(`圖片 ${newFile.name} 已經存在，將被跳過`);
                return false;
            }
            return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));

    if (uniqueNewFiles.length === 0) {
        alert('所選圖片都已經存在或沒有選擇新圖片！');
        this.value = '';
        return;
    }

    // 使用 Promise.all 等待所有圖片載入完成
    try {
        const loadPromises = uniqueNewFiles.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = new Image();
                    img.onload = function() {
                        resolve({ img, file });
                    };
                    img.onerror = reject;
                    img.src = e.target.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });

        const loadedImages = await Promise.all(loadPromises);

        // 所有圖片載入完成後，一次性更新陣列
        loadedImages.forEach(({ img, file }) => {
            images.push(img);
            imageFiles.push(file);
        });

        // 重新排序所有圖片
        const combinedFiles = imageFiles.map((file, index) => ({
            file: file,
            image: images[index],
            annotations: imageAnnotations[index]
        }));

        combinedFiles.sort((a, b) => 
            a.file.name.localeCompare(b.file.name, undefined, {numeric: true})
        );

        // 更新所有陣列
        imageFiles = combinedFiles.map(item => item.file);
        images = combinedFiles.map(item => item.image);
        const newAnnotations = {};
        combinedFiles.forEach((item, index) => {
            if (item.annotations) {
                newAnnotations[index] = item.annotations;
            }
        });
        imageAnnotations = newAnnotations;

        // 選擇新添加的第一張圖片
        const firstNewImageIndex = imageFiles.findIndex(file => 
            uniqueNewFiles.some(newFile => newFile.name === file.name)
        );
        if (firstNewImageIndex !== -1) {
            loadImage(firstNewImageIndex);
        }

        updateImageList();
        saveState(); // 保存狀態
    } catch (error) {
        console.error('Error loading images:', error);
        alert('載入圖片時發生錯誤');
    }

    this.value = '';
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
        // 取得類別 ID 和類別物件
        const classId = box.class;
        const classObj = classes[classId];
        if (!classObj) {
            console.error('Class not found for id:', classId);
            return;
        }
        const boxColor = classObj.color;
        
        // 從中心點座標計算左上角座標
        const x = (box.x - box.width/2) * canvas.width;
        const y = (box.y - box.height/2) * canvas.height;
        const width = box.width * canvas.width;
        const height = box.height * canvas.height;
        
        // 繪製框框
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.strokeRect(x, y, width, height);
        
        // 繪製標籤背景和文字
        ctx.font = '14px Arial';
        // 根據 showClassId 切換顯示
        const labelText = showClassId ? String(classId) : classObj.name;
        console.log('showClassId:', showClassId, 'labelText:', labelText); // 添加除錯訊息
        const textWidth = ctx.measureText(labelText).width;
        
        // 繪製標籤背景
        ctx.fillStyle = boxColor;
        // ctx.fillRect(x - 1, y - 20, textWidth + 10, 20);
        ctx.fillRect(x - 1, y, textWidth + 10, 20);

        // 繪製標籤文字
        ctx.fillStyle = 'white';
        ctx.fillText(labelText, x + 5, y + 15);
        
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
        isDash = true; // 開始繪製時設置為 true
        startX = clickX;
        startY = clickY;
    }
});

canvas.addEventListener("mousemove", (event) => {
    if (!isDrawing || !isDash) return; // 檢查 isDash
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const currentX = (event.clientX - rect.left) * scaleX;
    const currentY = (event.clientY - rect.top) * scaleY;
    
    // 重繪畫布和現有的標註
    const img = images[currentImageIndex];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    drawBoundingBoxes();
    
    // 只有在 isDash 為 true 時才畫虛線框
    if (isDash) {
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = currentClass ? currentClass.color : "#ff0000";
        ctx.lineWidth = 2;
        
        const x = Math.min(Math.max(0, Math.min(startX, currentX)), canvas.width);
        const y = Math.min(Math.max(0, Math.min(startY, currentY)), canvas.height);
        const width = Math.min(Math.abs(startX - currentX), canvas.width - x);
        const height = Math.min(Math.abs(startY - currentY), canvas.height - y);
        
        ctx.strokeRect(x, y, width, height);
        ctx.setLineDash([]);
    }
});

canvas.addEventListener("mouseup", (event) => {
    if (!isDrawing) return;
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const currentX = (event.clientX - rect.left) * scaleX;
    const currentY = (event.clientY - rect.top) * scaleY;

    isDash = false;

    // 計算框的左上角和尺寸
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(startX - currentX);
    const height = Math.abs(startY - currentY);

    // 轉換為中心點座標
    const centerX = (left + width/2) / canvas.width;
    const centerY = (top + height/2) / canvas.height;
    const normalizedWidth = width / canvas.width;
    const normalizedHeight = height / canvas.height;

    if (width > 0 && height > 0) {
        const classIndex = classes.indexOf(currentClass).toString();
        const newBox = {
            class: classIndex,
            x: centerX,
            y: centerY,
            width: normalizedWidth,
            height: normalizedHeight
        };
        currentBoxes.push(newBox);
        
        if (currentImageIndex !== undefined) {
            imageAnnotations[currentImageIndex] = [...currentBoxes];
        }

        const img = images[currentImageIndex];
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        drawBoundingBoxes();
        updateAnnotations();
        
        setTimeout(() => {
            isDrawing = false;
        }, 100);
    } else {
        isDrawing = false;
    }
});

// Update annotations textarea
function updateAnnotations() {
    if (!annotationsTextarea) return;
    
    if (!Array.isArray(currentBoxes)) {
        console.error('currentBoxes is not an array:', currentBoxes);
        return;
    }
    
    try {
        const annotations = currentBoxes.map(box => {
            if (!box.x || !box.y || !box.width || !box.height) {
                console.error('Invalid box data:', box);
                return '';
            }
            // 直接使用 box.class，它已經是正確的類別 ID
            return `${box.class} ${box.x.toFixed(6)} ${box.y.toFixed(6)} ${box.width.toFixed(6)} ${box.height.toFixed(6)}`;
        }).filter(text => text !== '');
        
        annotationsTextarea.value = annotations.join('\n');
    } catch (error) {
        console.error('Error updating annotations:', error);
    }
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
        
        // 延遲下載避免覽器阻擋
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
    document.getElementById('newClassColor').value = generateRandomColor();
}

function closeAddClassDialog() {
    document.getElementById('addClassDialog').style.display = 'none';
}

function addClassConfirm() {
    const name = document.getElementById('newClassName').value;
    const color = document.getElementById('newClassColor').value;
    
    if (name) {
        const existingClass = classes.find(cls => cls.name === name);
        if (existingClass) {
            alert('類別名稱已存在！');
            return;
        }

        classes.push({ 
            name: name, 
            color: color
        });

        updateClassList();
        closeAddClassDialog();
        saveState(); // 保存狀態
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
        
        if (currentClass === cls || (classes.length === 1 && !currentClass)) {
            div.classList.add('selected');
            div.style.backgroundColor = '#e3f2fd';
            div.style.borderLeft = '4px solid #1976d2';
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
                <span class="class-name" title="${index}: ${cls.name}">${cls.name}</span>
            </div>
        `;
        
        // 為 class-info 添加點擊事件
        const classInfo = div.querySelector('.class-info');
        classInfo.addEventListener('click', (e) => {
            e.stopPropagation();
            selectClass(index);
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
    // 更新所有圖片中的標註
    Object.keys(imageAnnotations).forEach(imageIndex => {
        const annotations = imageAnnotations[imageIndex];
        if (annotations) {
            // 先過濾掉被刪除的類別的標註
            imageAnnotations[imageIndex] = annotations.filter(box => {
                return parseInt(box.class) !== index;
            });
            
            // 更新剩餘標註的類別索引
            imageAnnotations[imageIndex] = imageAnnotations[imageIndex].map(box => {
                const boxClassId = parseInt(box.class);
                if (boxClassId > index) {
                    return {
                        ...box,
                        class: (boxClassId - 1).toString()
                    };
                }
                return box;
            });
        }
    });

    // 更新當前圖片的標註
    currentBoxes = currentBoxes.filter(box => {
        return parseInt(box.class) !== index;
    });
    
    // 更新當前圖片標註的類別索引
    currentBoxes = currentBoxes.map(box => {
        const boxClassId = parseInt(box.class);
        if (boxClassId > index) {
            return {
                ...box,
                class: (boxClassId - 1).toString()
            };
        }
        return box;
    });
    
    // 刪除類別
    classes.splice(index, 1);
    
    // 如果刪除的是當前選中的類別
    if (currentClass && classes.indexOf(currentClass) === index) {
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

    // 選擇新的圖片
    if (images.length > 0) {
        const newIndex = index >= images.length ? images.length - 1 : index;
        loadImage(newIndex);
    } else {
        currentImageIndex = undefined;
        currentBoxes = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    updateImageList();
    saveState(); // 保存狀態
}

// 修改下載類別檔案的功能
document.getElementById('download-classes').addEventListener("click", () => {
    // 只輸出類別名稱，每行一個
    const classesText = classes.map(cls => cls.name).join("\n");
    const blob = new Blob([classesText], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "classes.txt";
    link.click();
    URL.revokeObjectURL(link.href);
});

// 添加滑鼠移��事件來改變游標樣式
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

// 修改標註文本域的樣
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

    try {
        // 處理 zip 或單個文件
        if (files[0].name.endsWith('.zip')) {
            const zip = await JSZip.loadAsync(files[0]);
            
            for (let filename in zip.files) {
                if (filename.endsWith('.txt')) {
                    const content = await zip.files[filename].async('text');
                    const imageName = filename.replace('.txt', '');
                    
                    const imageIndex = imageFiles.findIndex(file => 
                        file.name.replace(/\.[^/.]+$/, '') === imageName
                    );

                    if (imageIndex !== -1) {
                        processAnnotationContent(content, imageIndex);
                    }
                }
            }
        } else {
            for (let file of files) {
                if (!file.name.endsWith('.txt')) continue;

                const content = await file.text();
                const imageName = file.name.replace('.txt', '');
                
                const imageIndex = imageFiles.findIndex(file => 
                    file.name.replace(/\.[^/.]+$/, '') === imageName
                );

                if (imageIndex !== -1) {
                    processAnnotationContent(content, imageIndex);
                }
            }
        }

        // 更新當前圖片的顯示
        if (currentImageIndex !== undefined) {
            currentBoxes = imageAnnotations[currentImageIndex] || [];
            drawBoundingBoxes();
            updateAnnotations();
        }

        alert('標註匯入完成');
    } catch (error) {
        console.error('Error importing annotations:', error);
        alert('匯入標註時發生錯誤');
    }

    e.target.value = '';
});

// 修改處理標註內容的輔助函數
function processAnnotationContent(content, imageIndex) {
    const annotations = content.split('\n')
        .filter(line => line.trim())
        .map(line => {
            const [classId, x, y, width, height] = line.split(' ').map(Number);
            // 直接使用原始的類別 ID
            return {
                class: classId.toString(), // 轉為字串以保持一致性
                x, y, width, height
            };
        });
    
    imageAnnotations[imageIndex] = annotations;
}

// 修改生成隨機顏色的函數
function generateRandomColor() {
    // 生成隨機的 RGB 值
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    
    // 轉換為十六進制格式
    const rHex = r.toString(16).padStart(2, '0');
    const gHex = g.toString(16).padStart(2, '0');
    const bHex = b.toString(16).padStart(2, '0');
    
    // 返回 #RRGGBB 格式的顏色
    return `#${rHex}${gHex}${bHex}`;
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
        const usedColors = new Set();
        
        // 解析類別檔案，每行一個類別名稱
        content.split('\n').forEach((line, index) => {
            const className = line.trim();
            if (className) {
                // 生成不重複的顏色
                let color;
                do {
                    color = generateRandomColor();
                } while (usedColors.has(color));
                usedColors.add(color);

                newClasses.push({
                    name: className,
                    color: color,
                    index: index
                });
            }
        });

        classes = newClasses;
        
        // 更新類別列表
        const classList = document.querySelector('.right-panel .class-list');
        if (classList) {
            classList.innerHTML = '';
            classes.forEach((cls, index) => {
                const div = document.createElement('div');
                div.className = 'class-item';
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
                        <span class="class-name" title="${index}: ${cls.name}">${cls.name}</span>
                    </div>
                `;

                // 為整個項目添加點擊事件
                div.addEventListener('click', (e) => {
                    if (!e.target.closest('.color-picker') && !e.target.closest('.delete-btn')) {
                        selectClass(index);
                    }
                });

                // 為 class-info 添加點擊事件
                const classInfo = div.querySelector('.class-info');
                classInfo.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectClass(index);
                });

                classList.appendChild(div);
            });
        }

        // 如果只有一個類別，自動選擇它
        if (classes.length === 1) {
            selectClass(0);
        }

        // 重繪前圖片
        if (currentImageIndex !== undefined && images[currentImageIndex]) {
            ctx.drawImage(images[currentImageIndex], 0, 0, canvas.width, canvas.height);
            drawBoundingBoxes();
        }

        alert('類別匯入完成');
    } catch (error) {
        console.error('Error importing classes:', error);
        alert('匯入類別時發生錯誤');
    }

    e.target.value = '';
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
        setTimeout(adjustCanvasSize, 300); // 等待過渡畫完成
    });

    // 修改右側面板切換
    rightToggle.addEventListener('click', () => {
        rightPanel.classList.toggle('collapsed');
        setTimeout(adjustCanvasSize, 300); // 等待過渡動畫完成
    });

});

// 修改 adjustCanvasSize 函數
function adjustCanvasSize() {
    const container = document.getElementById('image-container');
    const containerWidth = container.clientWidth - 40;  // 減去 padding
    const containerHeight = container.clientHeight - 40;

    if (!images[currentImageIndex]) {
        // 當沒有圖片時，設置畫布為容器大小
        canvas.width = containerWidth;
        canvas.height = containerHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const img = images[currentImageIndex];
    
    // 計算圖片應該的大小，保持比例
    const imageRatio = img.width / img.height;
    const containerRatio = containerWidth / containerHeight;
    
    let width, height;
    
    if (imageRatio > containerRatio) {
        width = containerWidth;
        height = containerWidth / imageRatio;
    } else {
        height = containerHeight;
        width = containerHeight * imageRatio;
    }
    
    canvas.width = width;
    canvas.height = height;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    drawBoundingBoxes();
}


// 添加視窗大小改變時的處理
window.addEventListener('resize', () => {
    adjustCanvasSize();
});

// 在 DOMContentLoaded 時初始化 canvas 大小
document.addEventListener('DOMContentLoaded', () => {
    adjustCanvasSize();
});

// 在恢復狀態後也要調整 canvas 大小
async function restoreState() {
    try {
        const savedState = localStorage.getItem('labelingState');
        if (!savedState) {
            adjustCanvasSize(); // 如果沒有保存的狀態，也要調整 canvas 大小
            return;
        }
        // ... 其他恢復狀態的代碼 ...
    } catch (error) {
        console.error('Error restoring state:', error);
        adjustCanvasSize(); // 如果恢復失敗，也要調整 canvas 大小
    }
}

// 修改 canvas 的點擊事件處理
canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (event.clientX - rect.left) * scaleX;
    const clickY = (event.clientY - rect.top) * scaleY;


    if (isDrawing) return; 


    // 檢查是否點擊到刪除按鈕
    currentBoxes.forEach((box, index) => {
        if (box.deleteButtonPath && ctx.isPointInPath(box.deleteButtonPath, clickX, clickY)) {
            // 刪除標註
            currentBoxes.splice(index, 1);
            
            // 保存到當前圖片的標註
            if (currentImageIndex !== undefined) {
                imageAnnotations[currentImageIndex] = [...currentBoxes];
            }
            
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


// 添加保存狀態的函數
function saveState() {
    try {
        // 將圖片資料轉換為 URL
        const imageDataUrls = images.map(img => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(img, 0, 0);
            return tempCanvas.toDataURL();
        });

        const state = {
            imageFiles: imageFiles.map(file => ({
                name: file.name,
                type: file.type,
                lastModified: file.lastModified
            })),
            imageDataUrls,
            imageAnnotations,
            classes,
            currentImageIndex,
            currentClass: currentClass ? classes.indexOf(currentClass) : null
        };

        localStorage.setItem('labelingState', JSON.stringify(state));
    } catch (error) {
        console.error('Error saving state:', error);
    }
}
// 修改恢復狀態的函數
async function restoreState() {
    try {
        const savedState = localStorage.getItem('labelingState');
        if (!savedState) return;

        const state = JSON.parse(savedState);

        // 恢復類別
        classes = state.classes;
        currentClass = state.currentClass !== null ? classes[state.currentClass] : null;

        // 恢復圖片
        images = [];
        for (let dataUrl of state.imageDataUrls) {
            const img = new Image();
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
                img.src = dataUrl;
            });
            images.push(img);
        }

        // 恢復其他資料
        imageFiles = state.imageFiles;
        imageAnnotations = state.imageAnnotations;
        currentImageIndex = state.currentImageIndex;
        currentBoxes = imageAnnotations[currentImageIndex] || [];

        // 更新界面
        updateClassList();
        updateImageList();
        updateAnnotations();
        if (currentImageIndex !== undefined && images[currentImageIndex]) {
            adjustCanvasSize();
            drawBoundingBoxes();
        }
    } catch (error) {
        console.error('Error restoring state:', error);
    }
}

// 在適當的地方保存狀態
function addStateHandlers() {
    // 當頁面要失去焦點時保存狀態
    window.addEventListener('blur', saveState);
    
    // 當頁面關閉時保存狀態
    window.addEventListener('beforeunload', saveState);
    
    // 當頁面載入時恢復狀態
    window.addEventListener('load', restoreState);
}

// 在頁面載入時初始化
document.addEventListener('DOMContentLoaded', addStateHandlers);

// 在資料變更的地方也要保存狀態
// 例如在 loadImage, updateAnnotations 等函數的最後添加：
// saveState();

// 修改清除狀態的函數
function clearState() {
    if (confirm('確定要清除所有資料嗎？這個操作無法復原。')) {
        localStorage.removeItem('labelingState');
        images = [];
        imageFiles = [];
        imageAnnotations = {};
        classes = [];
        currentClass = null;
        currentImageIndex = undefined;
        currentBoxes = [];
        
        // 清除畫布並調整大小
        adjustCanvasSize();
        
        // 更新界面
        updateClassList();
        updateImageList();
        updateAnnotations();
        
        alert('所有資料已清除');
    }
}

// 添加切換標註顯示的函數
function toggleLabelDisplay() {
    showClassId = !showClassId;
    // 添加除錯訊息
    // alert('Toggle label display, showClassId:' + showClassId);
    
    // 重新繪製畫布
    if (currentImageIndex !== undefined && images[currentImageIndex]) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(images[currentImageIndex], 0, 0, canvas.width, canvas.height);
        drawBoundingBoxes();
    }
}

// 綁定清除按鈕事件
document.getElementById('clear-state').addEventListener('click', clearState);

function showHelpDialog() {
    document.getElementById('helpDialog').style.display = 'block';
}

function closeHelpDialog() {
    document.getElementById('helpDialog').style.display = 'none';
}

// 添加按鈕點擊事件
document.getElementById('help').addEventListener('click', showHelpDialog);

// 添加切換標註
document.getElementById('toggle-label').addEventListener('click', toggleLabelDisplay);


