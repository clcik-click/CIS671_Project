"use client";

import { useRef, useState, useEffect } from "react";
import { redrawCanvas } from "@/app/utils/canvasUtils";
import { sendDataToBackend, fetchSAMImage } from "@/app/lib/api"; 

export default function main() {
  const canvasOne = useRef<HTMLCanvasElement>(null);
  const canvasTwo = useRef<HTMLCanvasElement>(null);
  const canvasThree = useRef<HTMLCanvasElement>(null);
  const canvasFour = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  
  const canvasHeight = 500;
  const [initScale, setInitScale] = useState(1);

  const [canvasWidth, setCanvasWidth] = useState(0);
  const [image, setImage] = useState<File | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  const [zoom, setZoom] = useState(1);

  const [lastMouseX, setLastMouseX] = useState(null);
  const [lastMouseY, setLastMouseY] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<any[]>([]);

  const [loading, setLoading] =useState(false);

  // Handles user input file
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setImage(e.target.files[0]);
    }
  };
  
  useEffect(() => {
    if (!image) return;

    const img = new Image();
    img.src = URL.createObjectURL(image);

    img.onload = () => {
      imgRef.current = img;
      const scale = canvasHeight / img.height;
      const scaledWidth = img.width * scale;

      setCanvasWidth(scaledWidth);
      setOffsetX(0);
      setOffsetY(0);
      setInitScale(1 / scale);

    };
  }, [image]);

  useEffect(() => {
    redrawCanvas(canvasOne, imgRef.current, strokes, offsetX, offsetY, canvasWidth, canvasHeight, zoom);
  }, [strokes, offsetX, offsetY, canvasWidth, zoom]);

  useEffect(() => {
    redrawCanvas(canvasTwo, imgRef.current, strokes, 0, 0, canvasWidth, canvasHeight, 1);
  }, [strokes, offsetX, offsetY, canvasWidth]);

  const onWheel = (e) => {
    e.preventDefault(); // Prevent default scrolling behavior
  
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1; // Zoom in on scroll up, out on scroll down
    const newZoom = zoom * zoomFactor;
  
    // Get the actual center of the canvas (not the webpage)
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;
  
    // Adjust offset to keep zoom centered at the canvas center
    const newOffsetX = centerX - (centerX - offsetX) * (newZoom / zoom);
    const newOffsetY = centerY - (centerY - offsetY) * (newZoom / zoom);
  
    // Update state
    setZoom(newZoom);
    setOffsetX(newOffsetX);
    setOffsetY(newOffsetY);
  };

  const onMouseDown = (e) => {
    // Drawing - creates new stroke with an intial point
    if (e.button === 0) {
      setIsDrawing(true);
    const x = (e.nativeEvent.offsetX - offsetX) / zoom;
    const y = (e.nativeEvent.offsetY - offsetY) / zoom;
      setStrokes((prevStrokes) => [...prevStrokes, { points: [{ x, y }] }]);
    }

    // Panning
    if (e.button === 2) {
      setIsDragging(true);
      setLastMouseX(e.clientX);
      setLastMouseY(e.clientY);
    }
  };

  const onMouseMove = (e) => {
    if (!isDrawing && !isDragging) return;

    // Panning
    if (isDragging) {
      let dx = (e.clientX - lastMouseX)
      let dy = (e.clientY - lastMouseY)
      setOffsetX((prev) => prev + dx);
      setOffsetY((prev) => prev + dy);
      setLastMouseX(e.clientX);
      setLastMouseY(e.clientY);
      return;
    }

    // Drawing - adds more points to the last stroke
    if (isDrawing) {
      const x = (e.nativeEvent.offsetX - offsetX) / zoom;
      const y = (e.nativeEvent.offsetY - offsetY) / zoom;

      setStrokes((prevStrokes) => {
        const updatedStrokes = [...prevStrokes];
        if (updatedStrokes.length === 0) return prevStrokes;
        updatedStrokes[updatedStrokes.length - 1].points.push({ x, y });
        return updatedStrokes;
      });
    }
  };

  const onMouseUp = (e) => {
    // Drawing - stops drawing
    if (e.button === 0) {
      setIsDrawing(false);
    }

    // Panning - stops panning
    if (e.button === 2) {
      setIsDragging(false);
    }
  };

  const onContextMenu = (e) => {
    e.preventDefault(); 
  };

  const scaleStrokesBackUp = (strokes: any[]) => {
    return strokes.map(stroke => ({
      points: stroke.points.map(point => ({
        x: point.x * initScale, // Scale back up to original size
        y: point.y * initScale,
      }))
    }));
  };

  const handleSend = async () => {
    if (!image) {
      console.log("No image selected!");
      return;
    }
    const adjustedStrokes = scaleStrokesBackUp(strokes); // Scale strokes back

    await sendDataToBackend(image, adjustedStrokes); // Send image + strokes
  };

  const handleFetchSAMImage = async () => {
    setLoading(true); // Show loading indicator
    const imageSrc = await fetchSAMImage();
    setLoading(false); // Hide loading indicator

    if (!imageSrc) {
        console.error("Failed to fetch SAM image.");
        return;
    }

    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
        const canvas = canvasThree.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear previous content
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height); // Draw fetched image
    };
  };

  return (
    <div>
      <div className="flex flex-col items-center gap-4 p-4">
        <div className="flex gap-20">
          <div>
            <input type="file" accept="image/*" onChange={handleFile} className="w-full mb-2 border p-2"/>
            <div
              className="border relative overflow-hidden"
              style={{ width: canvasWidth, height: canvasHeight }}
              onMouseDown={onMouseDown}
              onMouseUp={onMouseUp}
              onMouseMove={onMouseMove}
              onContextMenu={onContextMenu}
              onWheel={onWheel}
            >
              <canvas ref={canvasOne} width={canvasWidth} height={canvasHeight} className="absolute top-0 left-0"/>
            </div>
          </div>

          <div>
            <button onClick={handleSend} className="w-full mb-2 border p-2">
              Send to Backend
            </button>
            <div
              className="border relative overflow-hidden"
              style={{ width: canvasWidth, height: canvasHeight }}
            >
              <canvas ref={canvasTwo} width={canvasWidth} height={canvasHeight} className="absolute top-0 left-0"/>
            </div>
          </div>
        </div>
      </div>

      <div>
        <button 
          onClick={handleFetchSAMImage} 
          className="w-full mb-2 border p-2 bg-blue-500 text-white rounded"
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh SAM Image"}
        </button>
      </div>

      <div className="flex flex-col items-center gap-4 p-4">
        <div className="flex gap-20">
          <div>
            <p className="w-full mb-2 border p-2">SAM Image</p>
            <div
              className="border relative overflow-hidden"
              style={{ width: canvasWidth, height: canvasHeight }}
            >
              <canvas ref={canvasThree} width={canvasWidth} height={canvasHeight} className="absolute top-0 left-0"/>
            </div>
          </div>

          <div>
            <p className="w-full mb-2 border p-2">TagLab Image</p>
            <div
              className="border relative overflow-hidden"
              style={{ width: canvasWidth, height: canvasHeight }}
            >
              <canvas ref={canvasFour} width={canvasWidth} height={canvasHeight} className="absolute top-0 left-0"/>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};