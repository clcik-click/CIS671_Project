// Handles the drawing area for the main canvas (used for full-resolution drawing)
export const redrawCanvas = (
  canvasRef: React.RefObject<HTMLCanvasElement>, // Reference to the canvas element
  imgRef: HTMLImageElement | null,               // Image element to draw
  strokes: any[],                                // User-drawn strokes
  offsetX: number,                               // X offset for image placement
  offsetY: number,                               // Y offset for image placement
  imageWidth: number,                            // Width of the image (adjusted)
  imageHeight: number,                           // Height of the image (adjusted)
  zoom: number                                   // Zoom factor
) => {
  if (!imgRef || !canvasRef.current) return;

  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;

  // Draw the image with applied zoom and offset
  ctx.drawImage(imgRef, offsetX, offsetY, imageWidth * zoom, imageHeight * zoom);

  // Configure stroke style for drawing
  ctx.lineWidth = 2 * zoom; // Adjust stroke width based on zoom
  ctx.lineCap = "round";
  ctx.strokeStyle = "red";

  // Draw each stroke
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

// Handles the overview area (scaled-down view for reference)
export const redrawCanvas2 = (
  canvasRef: React.RefObject<HTMLCanvasElement>, // Reference to the smaller canvas
  imgRef: HTMLImageElement | null,               // Image element to draw
  strokes: any[],                                // User-drawn strokes
  offsetX: number,                               // X offset for image placement
  offsetY: number,                               // Y offset for image placement
  imageWidth: number,                            // Width of the image (adjusted)
  imageHeight: number,                           // Height of the image (adjusted)
  zoom: number                                   // Scaling factor (e.g., 0.5)
) => {
  if (!imgRef || !canvasRef.current) return;

  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;

  // Draw the scaled-down image
  ctx.drawImage(imgRef, offsetX, offsetY, imageWidth, imageHeight);

  // Configure stroke style for drawing
  ctx.lineWidth = 1; // Fixed small stroke for overview
  ctx.lineCap = "round";
  ctx.strokeStyle = "red";

  // Draw strokes with zoom scaling
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