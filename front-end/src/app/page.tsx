"use client";

import { useRef, useState, useEffect } from "react";
import { redrawCanvas, redrawCanvas2 } from "@/app/utils/canvasUtils";
import { sendDataToBackend, pollProcessingStatus, fetchProcessedImage  } from "@/app/lib/api"; 

export default function main() {
  const canvasOne = useRef<HTMLCanvasElement>(null);
  const canvasTwo = useRef<HTMLCanvasElement>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);

  const mainCanvasWidth     = 800;
  const mainCanvasHeight    = 600;
  const smallCanvasWidth    = 400;
  const smallCanvasHeight   = 300;

  const [iOffsetX, setIOffsetX]     = useState(0);
  const [iOffsetY, setIOffsetY]     = useState(0);
  const [initScale, setInitScale]   = useState(1);

  const [zoom, setZoom]           = useState(1);

  const [image, setImage]         = useState<File | null>(null);
  const [offsetX, setOffsetX]     = useState(0);
  const [offsetY, setOffsetY]     = useState(0);
  const [imgW, setImgW]           = useState(0);
  const [imgH, setImgH]           = useState(0);

  const [lastMouseX, setLastMouseX] = useState(null);
  const [lastMouseY, setLastMouseY] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawing, setIsDrawing]   = useState(false);
  const [strokes, setStrokes]       = useState<any[]>([]);

  const [sending, setSending]       = useState(false);
  const [processing, setProcessing] = useState(false);
  const [done, setDone]             = useState(false);
  const [processedImage, setProcessedImage] = useState(null);

  // User inputs image file
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) { 
      setImage(e.target.files[0]);
    }
  };
  
  // Image processing to fit viewing window
  useEffect(() => {
    if (!image) return;

    const objectURL = URL.createObjectURL(image);
    const img       = new Image();
    img.src         = objectURL;

    img.onload = () => {
      imgRef.current      = img;
      const width_ratio   = 800 / img.width;
      const height_ratio  = 600 / img.height;
      const scale         = Math.min(width_ratio, height_ratio);
      const img_w         = img.width * scale; 
      const img_h         = img.height * scale;
      const offX          = (800 - img_w) / 2; 
      const offY          = (600 - img_h) / 2; 

      setIOffsetX(offX);
      setIOffsetY(offY);
      setInitScale(1 / scale);

      setImgW(img_w);
      setImgH(img_h);
      setOffsetX(offX);
      setOffsetY(offY);
      
    };
  }, [image]);

  // Image processing for the drawing section
  useEffect(() => {
    redrawCanvas(canvasOne, imgRef.current, strokes, offsetX, offsetY, imgW, imgH, zoom);
  }, [strokes, offsetX, offsetY, imgW, imgH, zoom]);

  // Image processing for the overview section
  useEffect(() => {
    redrawCanvas2(canvasTwo, imgRef.current, strokes, iOffsetX/2, iOffsetY/2, imgW/2, imgH/2, 0.5);
  }, [strokes, imgW, imgH]);

  const onWheel = (e) => {
    e.preventDefault(); 
  
    // Zoom in on scroll up, out on scroll down
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1; 
    const newZoom = zoom * zoomFactor;
  
    // Get the actual center of the canvas (not the webpage)
    const centerX = mainCanvasWidth / 2;
    const centerY = mainCanvasHeight / 2;
  
    // Adjust offset to keep zoom centered at the canvas center
    const newOffsetX = centerX - (centerX - offsetX) * (newZoom / zoom);
    const newOffsetY = centerY - (centerY - offsetY) * (newZoom / zoom);
  
    // Update state
    setZoom(newZoom);
    setOffsetX(newOffsetX);
    setOffsetY(newOffsetY);
  };

  // Disables normal mouse-scrolling behavior
  useEffect(() => {
    const canvasContainer = canvasOne.current;

    if (canvasContainer) {
      canvasContainer.addEventListener("wheel", onWheel, { passive: false });

      return () => {
        canvasContainer.removeEventListener("wheel", onWheel);
      };
    }
  }, []);

  // Handles mouse-click
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

  // Handles mouse-move
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

  // Handles mouse-release
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

  // Disables normal right-click behavior
  const onContextMenu = (e) => {
    e.preventDefault(); 
  };

  // Adjusts strokes to original picture size
  const scaleStrokesBackUp = (strokes: any[]) => {
    return strokes.map(stroke => ({
      points: stroke.points.map(point => ({
        x: point.x * initScale, 
        y: point.y * initScale,
      }))
    }));
  };

  // Sends data to Flask
  const sendToBackend = async () => {
    if (!image) {
      console.log("No image selected!");
      return;
    }

    // Scales strokes back
    const adjustedStrokes = scaleStrokesBackUp(strokes); 
    
    setSending(true);
    setProcessing(true);
    setDone(false);

    const uploadSuccess = await sendDataToBackend(image, adjustedStrokes);
    setSending(false);

    if (uploadSuccess) {
      const processingComplete = await pollProcessingStatus();
      if (processingComplete) {
        setProcessing(false);
        setDone(true);
      }
    }
  };

  // Fetches data from Flask
  const handleFetchProcessedImage = async () => {
    const imageUrl = await fetchProcessedImage();
    if (imageUrl) {
      setProcessedImage(imageUrl);
    }
  };

  return (
    <div className="">

      {/* Describes the page topic */}
      <div className="flex w-6/10 mx-auto">
        <p className="w-full h-[400px] mb-2 border p-2 flex items-center justify-center text-center">Intro and tasks</p>
      </div>

      {/* Seperator */}
      <div className="flex w-6/10 mx-auto">
        <hr className="my-8 border-t-2 border-gray-300 w-full" />
      </div>

      {/* Area for contains drawing features */}
      <div className="flex flex-wrap w-6/10 mx-auto">
        <div className="lex w-full" >
          <input type="file" accept="image/*" onChange={handleFile} className="w-1/2 border p-2"/>
          <button onClick={sendToBackend} disabled={sending || processing} className="w-1/2 border p-2 bg-blue-500 text-white">
            Send data to Flask
          </button>

        </div>
        <div className="flex w-full">
          <div id="your-canvas-container"
            className="border relative overflow-hidden w-[800px] h-[600px]"
            style         ={{ width: mainCanvasWidth, height: mainCanvasHeight }}
            onMouseDown   ={onMouseDown}
            onMouseUp     ={onMouseUp}
            onMouseMove   ={onMouseMove}
            onContextMenu ={onContextMenu}
            onWheel       ={onWheel}
          >
            <canvas ref={canvasOne} width={mainCanvasWidth} height={mainCanvasHeight} className="absolute top-0 left-0"/>
          </div>

          <div className="flex-1 h-[600px] flex items-center justify-center border">
            <p>Drawing instructions</p>
          </div>
        </div>
      </div>

      {/* Seperator */}
      <div className="flex w-6/10 mx-auto">
        <hr className="my-8 border-t-2 border-gray-300 w-full" />
      </div>

      {/* Loading area */}
      <div className="flex flex-col items-center mt-4">
        {processing && (
          <p className="text-lg text-gray-700 font-medium animate-pulse">
            Processing... Please wait.
          </p>
        )}

        {done && (
          <p className="text-lg text-green-600 font-semibold">
            ✅ Processing Complete! Click <span className="underline">"Get data"</span>.
          </p>
        )}
      </div>

      {/* Loading button */}
      <div className="flex justify-center">
        <button 
          onClick={handleFetchProcessedImage} 
          disabled={!done}
          className="mt-4 px-4 py-2 bg-blue-500 text-white font-semibold rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Get data from Flask
        </button>
      </div>

      {/* Seperator */}
      <div className="flex w-6/10 mx-auto">
        <hr className="my-8 border-t-2 border-gray-300 w-full" />
      </div>

      {/* Overview and Trend area */}
      <div className="flex w-3/5 mx-auto gap-4">
        {/* Left Column */}
        <div className="flex flex-col items-center w-1/2">
          <p className="text-center font-semibold text-lg mb-2">Overview</p>
          <div className="relative w-[400px] h-[300px] border flex items-center justify-center">
            <canvas ref={canvasTwo} width={smallCanvasWidth} height={smallCanvasHeight} className="w-full h-full"/>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col items-center w-1/2">
          <p className="text-center font-semibold text-lg mb-2">Trend</p>
          <div className="w-[400px] h-[300px] border flex items-center justify-center">
            <p>Bar chart</p>
          </div>
        </div>
      </div>

      {/* Seperator */}
      <div className="flex w-6/10 mx-auto">
        <hr className="my-8 border-t-2 border-gray-300 w-full" />
      </div>

      {/* SAM Score and TagLab Score area */}
      <div className="flex w-3/5 mx-auto gap-4">
        {/* Left Column */}
        <div className="flex flex-col items-center w-1/2">
          <p className="text-center font-semibold text-lg mb-2">SAM Score</p>
          <div className="w-[400px] h-[300px] border flex items-center justify-center">
              {processedImage ? (
              <img src={processedImage} alt="SAM Segmentation" className="w-full h-full object-cover" />
            ) : (
              <p>SAM segmentation</p> // Placeholder text before image is loaded
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col items-center w-1/2">
          <p className="text-center font-semibold text-lg mb-2">TagLab Score</p>
          <div className="w-[400px] h-[300px] border flex items-center justify-center">
            <p>TagLab segmentation</p>
          </div>
        </div>
      </div>

      {/* Seperator */}
      <div className="flex w-6/10 mx-auto">
        <hr className="my-8 border-t-2 border-gray-300 w-full" />
      </div>


      {/* Conclusion */}
      <div className="flex w-6/10 mx-auto">
        <p className="w-full h-[200px] mb-2 border p-2 flex items-center justify-center text-center">Conclusion</p>
      </div>

    </div>
  );
};