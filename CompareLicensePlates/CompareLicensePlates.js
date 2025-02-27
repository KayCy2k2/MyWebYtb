export async function processImageFromCanvas(canvas, resultElement) {
    const worker = Tesseract.createWorker();
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");

    const { data: { text } } = await worker.recognize(canvas);
    resultElement.textContent = text.replace(/[^a-zA-Z0-9]/g, "").trim();

    await worker.terminate();
    checkAutoCompare();
}

export async function processImage(file, canvasElement, imgElement, resultElement) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.src = e.target.result;
            img.onload = function () {
                const canvas = canvasElement;
                const ctx = canvas.getContext("2d");

                // Resize ảnh
                const scale = 300 / img.width;
                canvas.width = 300;
                canvas.height = img.height * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Tiền xử lý ảnh với OpenCV.js
                let src = cv.imread(canvas);
                let gray = new cv.Mat();
                cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
                let blur = new cv.Mat();
                cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
                let edges = new cv.Mat();
                cv.Canny(blur, edges, 100, 200, 3, false);

                // Tìm khung biển số
                let contours = new cv.MatVector();
                let hierarchy = new cv.Mat();
                cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

                let maxRect = null;
                let maxArea = 0;
                for (let i = 0; i < contours.size(); i++) {
                    let rect = cv.boundingRect(contours.get(i));
                    let area = rect.width * rect.height;
                    if (area > maxArea) {
                        maxArea = area;
                        maxRect = rect;
                    }
                }

                // Cắt biển số
                if (maxRect) {
                    let cropped = new cv.Mat();
                    let rect = new cv.Rect(maxRect.x, maxRect.y, maxRect.width, maxRect.height);
                    cropped = src.roi(rect);
                    cv.imshow(canvas, cropped);
                    cropped.delete();
                }

                src.delete();
                gray.delete();
                blur.delete();
                edges.delete();
                contours.delete();
                hierarchy.delete();

                imgElement.src = canvas.toDataURL();

                // OCR bằng Web Worker
                const worker = new Worker(URL.createObjectURL(new Blob([`
                    importScripts("https://cdn.jsdelivr.net/npm/tesseract.js");
                    onmessage = async function (e) {
                        const result = await Tesseract.recognize(e.data.imgData, "eng");
                        postMessage(result.data.text.replace(/[^a-zA-Z0-9]/g, "").trim());
                    };
                `], { type: "application/javascript" })));

                worker.postMessage({ imgData: canvas.toDataURL() });

                worker.onmessage = function (event) {
                    resultElement.textContent = event.data;
                    resolve(event.data);
                    checkAutoCompare();
                };
            };
        };
        reader.readAsDataURL(file);
    });
}

export function comparePlates() {
    const text1 = document.getElementById("result1").textContent;
    const text2 = document.getElementById("result2").textContent;
    const compareResult = document.getElementById("compareResult");

    if (text1 && text2) {
        if (text1 === text2) {
            compareResult.textContent = "Biển số giống nhau ✅";
            compareResult.className = "mt-4 text-lg font-bold text-green-600";
        } else {
            compareResult.textContent = "Biển số khác nhau ❌";
            compareResult.className = "mt-4 text-lg font-bold text-red-600";
        }
    } else {
        compareResult.textContent = "Không thể nhận diện biển số!";
        compareResult.className = "mt-4 text-lg font-bold text-yellow-600";
    }
}

export function checkAutoCompare() {
    const autoCheck = document.getElementById("autoCheck").checked;
    const text1 = document.getElementById("result1").textContent;
    const text2 = document.getElementById("result2").textContent;
    if (autoCheck && text1 && text2) {
        comparePlates();
    }
}

export function setupEventListeners() {
    document.getElementById("imageInput1").addEventListener("change", async function () {
        await processImage(this.files[0], document.getElementById("canvas1"), document.getElementById("imagePreview1"), document.getElementById("result1"));
    });

    document.getElementById("imageInput2").addEventListener("change", async function () {
        await processImage(this.files[0], document.getElementById("canvas2"), document.getElementById("imagePreview2"), document.getElementById("result2"));
    });

    document.getElementById("compareBtn").addEventListener("click", comparePlates);
}
export function initCamera(videoElement, captureCanvas, openCameraBtn, captureBtn, imagePreview, resultElement) {
    let stream = null;

    openCameraBtn.addEventListener("click", async () => {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
            videoElement.srcObject = stream;
            videoElement.classList.remove("hidden");
            openCameraBtn.classList.add("hidden");
            captureBtn.classList.remove("hidden");
        } catch (error) {
            console.error("Không thể mở camera", error);
        }
    });

    captureBtn.addEventListener("click", () => {
        const ctx = captureCanvas.getContext("2d");
        captureCanvas.width = videoElement.videoWidth;
        captureCanvas.height = videoElement.videoHeight;
        ctx.drawImage(videoElement, 0, 0, captureCanvas.width, captureCanvas.height);
    
        // Dừng camera sau khi chụp
        stream.getTracks().forEach(track => track.stop());
        videoElement.classList.add("hidden");
        captureBtn.classList.add("hidden");
        openCameraBtn.classList.remove("hidden");
    
        // Hiển thị ảnh đã chụp
        imagePreview.src = captureCanvas.toDataURL();
        imagePreview.classList.remove("hidden");
    
        // Chuyển canvas thành Blob rồi xử lý bằng OCR
        captureCanvas.toBlob((blob) => {
            const file = new File([blob], "captured-image.png", { type: "image/png" });
            processImage(file, document.getElementById("canvas1"), document.getElementById("imagePreview1"), document.getElementById("result1"));
        }, "image/png");
    });    
}
