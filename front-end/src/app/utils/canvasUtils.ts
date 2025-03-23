// Handles the drawing area
export const redrawCanvas = (
    canvasRef: React.RefObject<HTMLCanvasElement>,
    imgRef: HTMLImageElement | null,
    strokes: any[],
    offsetX: number,
    offsetY: number,
    imageWidth: number,
    imageHeight: number,
    zoom: number
  ) => {
    if (!imgRef || !canvasRef.current) return;
  
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
  
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
  
    // Draw the image with zoom
    ctx.drawImage(imgRef, offsetX, offsetY, imageWidth * zoom, imageHeight * zoom);
  
    // Draw strokes
    ctx.lineWidth   = 2 * zoom;
    ctx.lineCap     = "round";
    ctx.strokeStyle = "red";
  
    strokes.forEach((stroke) => {
      ctx.beginPath();
      stroke.points.forEach((point: { x: number; y: number }, index: number) => {
        const drawX = point.x * zoom + offsetX;
        const drawY = point.y * zoom + offsetY;
        if (index === 0) ctx.moveTo(drawX, drawY);
        else ctx.lineTo(drawX, drawY);
      });
      ctx.stroke();
    });
  };

// Handles the overview area
export const redrawCanvas2 = (
    canvasRef: React.RefObject<HTMLCanvasElement>,
    imgRef: HTMLImageElement | null,
    strokes: any[],
    offsetX: number,
    offsetY: number,
    imageWidth: number,
    imageHeight: number,
    zoom: number
  ) => {
    if (!imgRef || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;

    // Draw the image with zoom
    ctx.drawImage(imgRef, offsetX, offsetY, imageWidth, imageHeight);

    // Draw strokes
    ctx.lineWidth   = 1;
    ctx.lineCap     = "round";
    ctx.strokeStyle = "red";

    strokes.forEach((stroke) => {
      ctx.beginPath();
      stroke.points.forEach((point: { x: number; y: number }, index: number) => {
        const drawX = point.x * zoom + offsetX;
        const drawY = point.y * zoom + offsetY;
        if (index === 0) ctx.moveTo(drawX, drawY);
        else ctx.lineTo(drawX, drawY);
      });
      ctx.stroke();
    });
  };
  