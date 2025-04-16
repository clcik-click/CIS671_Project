"use client";

import { useRef, useState, useEffect } from "react";
import { redrawCanvas, redrawCanvas2 } from "@/app/utils/canvasUtils";
import { sendDataToBackend, pollProcessingStatus, fetchProcessedImages } from "@/app/lib/api";

export default function main() {
  // Refs for DOM elements
  const canvasOne = useRef<HTMLCanvasElement>(null); // Main drawing canvas
  const canvasTwo = useRef<HTMLCanvasElement>(null); // Overview canvas
  const imgRef = useRef<HTMLImageElement | null>(null); // Original image reference

  // Canvas dimensions
  const mainCanvasWidth = 800;
  const mainCanvasHeight = 600;
  const smallCanvasWidth = 400;
  const smallCanvasHeight = 300;

  // Image positioning and scale info
  const [iOffsetX, setIOffsetX] = useState(0);
  const [iOffsetY, setIOffsetY] = useState(0);
  const [initScale, setInitScale] = useState(1);

  const [zoom, setZoom] = useState(1);

  // Image state
  const [image, setImage] = useState<File | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [imgW, setImgW] = useState(0);
  const [imgH, setImgH] = useState(0);

  // Mouse control states
  const [lastMouseX, setLastMouseX] = useState(null);
  const [lastMouseY, setLastMouseY] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<any[]>([]); // All drawn strokes
  const [undoneStrokes, setUndoneStrokes] = useState([]); // Stack for redo

  // Backend interaction states
  const [processing, setProcessing] = useState(false);
  const [done, setDone] = useState(false);
  const [SAMImage, setSAMImage] = useState(null);
  const [SAMI, setSAMI] = useState(null);
  const [CNNImage, setCNNImage] = useState(null);
  const [CNNI, setCNNI] = useState(null);
  const [trendImage, setTrendImage] = useState(null);

  // Handle image input
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setImage(e.target.files[0]);
    }
  };

  // Fit the image to the canvas when loaded
  useEffect(() => {
    if (!image) return;

    const objectURL = URL.createObjectURL(image);
    const img = new Image();
    img.src = objectURL;

    img.onload = () => {
      imgRef.current = img;
      const width_ratio = 800 / img.width;
      const height_ratio = 600 / img.height;
      const scale = Math.min(width_ratio, height_ratio);
      const img_w = img.width * scale;
      const img_h = img.height * scale;
      const offX = (800 - img_w) / 2;
      const offY = (600 - img_h) / 2;

      setIOffsetX(offX);
      setIOffsetY(offY);
      setInitScale(1 / scale);
      setImgW(img_w);
      setImgH(img_h);
      setOffsetX(offX);
      setOffsetY(offY);
    };
  }, [image]);

  // Redraw the main canvas with current strokes
  useEffect(() => {
    redrawCanvas(canvasOne, imgRef.current, strokes, offsetX, offsetY, imgW, imgH, zoom);
  }, [strokes, offsetX, offsetY, imgW, imgH, zoom]);

  // Redraw the overview canvas
  useEffect(() => {
    redrawCanvas2(canvasTwo, imgRef.current, strokes, iOffsetX / 2, iOffsetY / 2, imgW / 2, imgH / 2, 0.5);
  }, [strokes, imgW, imgH]);

  // Zoom handling with scroll
  const onWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = zoom * zoomFactor;
    const centerX = mainCanvasWidth / 2;
    const centerY = mainCanvasHeight / 2;
    const newOffsetX = centerX - (centerX - offsetX) * (newZoom / zoom);
    const newOffsetY = centerY - (centerY - offsetY) * (newZoom / zoom);
    setZoom(newZoom);
    setOffsetX(newOffsetX);
    setOffsetY(newOffsetY);
  };

  // Attach zoom behavior to canvas scroll
  useEffect(() => {
    const canvasContainer = canvasOne.current;
    if (canvasContainer) {
      canvasContainer.addEventListener("wheel", onWheel, { passive: false });
      return () => canvasContainer.removeEventListener("wheel", onWheel);
    }
  }, []);

  // Mouse down: begin drawing or start panning
  const onMouseDown = (e) => {
    if (e.button === 0) {
      setIsDrawing(true);
      const x = (e.nativeEvent.offsetX - offsetX) / zoom;
      const y = (e.nativeEvent.offsetY - offsetY) / zoom;
      setUndoneStrokes([]);
      setStrokes((prevStrokes) => [...prevStrokes, { points: [{ x, y }] }]);
    }
    if (e.button === 2) {
      setIsDragging(true);
      setLastMouseX(e.clientX);
      setLastMouseY(e.clientY);
    }
  };

  // Mouse move: drag canvas or draw
  const onMouseMove = (e) => {
    if (!isDrawing && !isDragging) return;

    if (isDragging) {
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      setOffsetX((prev) => prev + dx);
      setOffsetY((prev) => prev + dy);
      setLastMouseX(e.clientX);
      setLastMouseY(e.clientY);
      return;
    }

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

  // Mouse up: stop drawing or panning
  const onMouseUp = (e) => {
    if (e.button === 0) setIsDrawing(false);
    if (e.button === 2) setIsDragging(false);
  };

  // Undo last stroke
  const undo = () => {
    if (strokes.length === 0) return;
    const newStrokes = [...strokes];
    const popped = newStrokes.pop();
    setStrokes(newStrokes);
    setUndoneStrokes((prev) => [...prev, popped]);
  };

  // Redo last undone stroke
  const redo = () => {
    if (undoneStrokes.length === 0) return;
    const newUndone = [...undoneStrokes];
    const recovered = newUndone.pop();
    setUndoneStrokes(newUndone);
    setStrokes((prev) => [...prev, recovered]);
  };

  // Prevent browser context menu
  const onContextMenu = (e) => e.preventDefault();

  // Scale strokes back to original image dimensions
  const scaleStrokesBackUp = (strokes: any[]) => {
    return strokes.map(stroke => ({
      points: stroke.points.map(point => ({
        x: point.x * initScale,
        y: point.y * initScale,
      }))
    }));
  };

  // Upload to Flask server
  const sendToBackend = async () => {
    if (!image) return console.log("No image selected!");
    const adjustedStrokes = scaleStrokesBackUp(strokes);
    setProcessing(true);
    setDone(false);
    const uploadSuccess = await sendDataToBackend(image, adjustedStrokes);
    if (uploadSuccess) {
      const processingComplete = await pollProcessingStatus();
      if (processingComplete) {
        setProcessing(false);
        setDone(true);
      }
    }
  };

  // Fetch processed result from backend
  const handleFetchProcessedImages = async () => {
    const result = await fetchProcessedImages();
    if (result) {
      setSAMImage(result.sam);
      setSAMI(result.samI);
      setCNNImage(result.cnn);
      setCNNI(result.cnnI);
      setTrendImage(result.trend);
    }
  };
  
  return (
    <div className="">

      {/* Seperator */}
      <div className="flex w-6/10 mx-auto">
        <hr className="my-8 border-t-2 border-gray-300 w-full" />
      </div>

      {/* Describes the page topic */}
      <div className="w-6/10 mx-auto bg-black text-white border border-gray-700 p-6 rounded-md shadow-md">
        <h2 className="text-2xl font-bold mb-4 text-center">Intro and Tasks</h2>

        <p className="text-base leading-relaxed text-justify mb-6">
          Various machine learning models have been developed to detect and segment objects in images. Among them, 
          Segment Anything Model (SAM) and Mask R-CNN are two widely used approaches known for their performance in 
          image segmentation tasks. With the increasing availability of such tools, selecting the most effective one 
          for a specific application becomes crucial.

          <br /><br />

          In this project, SAM and Mask R-CNN are applied to images of coral reefs. Their performance will be 
          evaluated by comparing their output against manually drawn outlines, as well as against each other. 
          The goal is to determine which model provides more accurate and efficient segmentation results when 
          outlining coral reef structures.

        </p>

        <div>
          <h3 className="text-xl font-semibold mb-2">Questions</h3>
          <ul className="list-disc list-inside space-y-1 text-base">
            <li>What is the IOU (Intersection over Union - Jaccard’s Index) of SAM vs Human Drawn Outline?</li>
            <li>What is the IOU of Mask R-CNN vs Human Drawn Outline?</li>
            <li>What is the IOU for Mask R-CNN vs. SAM?</li>
            <li>What is better for finding outlines automatically?</li>
          </ul>
        </div>
      </div>

      {/* Seperator */}
      <div className="flex w-6/10 mx-auto">
        <hr className="my-8 border-t-2 border-gray-300 w-full" />
      </div>

      {/* Drawing Features Section */}
      <div className="w-6/10 mx-auto bg-black text-white rounded-lg shadow-md p-6 space-y-6 border border-gray-700">

        {/* File input */}
        <div>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFile} 
            className="w-full border border-gray-600 rounded px-3 py-2 text-sm bg-gray-800 text-white placeholder-gray-400"
          />
        </div>

        {/* Canvas area */}
        <div
          id="your-canvas-container"
          className="border border-gray-600 relative overflow-hidden mx-auto"
          style={{
            width: mainCanvasWidth,
            height: mainCanvasHeight,
          }}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseMove={onMouseMove}
          onContextMenu={onContextMenu}
          onWheel={onWheel}
        >
          <canvas
            ref={canvasOne}
            width={mainCanvasWidth}
            height={mainCanvasHeight}
            className="absolute top-0 left-0"
          />
        </div>

        {/* Undo/Redo buttons */}
        <div className="flex justify-center gap-6">
          <button
            onClick={undo}
            className="px-5 py-2 bg-red-600 text-white font-medium rounded-md shadow hover:bg-red-700 disabled:opacity-50"
            disabled={strokes.length === 0}
          >
            ⬅️ Undo
          </button>

          <button
            onClick={redo}
            className="px-5 py-2 bg-green-600 text-white font-medium rounded-md shadow hover:bg-green-700 disabled:opacity-50"
            disabled={undoneStrokes.length === 0}
          >
            ➡️ Redo
          </button>
        </div>

        {/* Instructions */}
        <div className="text-center border border-gray-600 rounded p-4 text-sm text-gray-300">
          Left-click to draw. Right-click to pan. Use mouse wheel to zoom. Use Undo/Redo to manage strokes.
        </div>
      </div>

      {/* Seperator */}
      <div className="flex w-6/10 mx-auto">
        <hr className="my-8 border-t-2 border-gray-300 w-full" />
      </div>

      {/* Loading area */}
      <div className="w-6/10 mx-auto bg-black text-white p-6 rounded-lg border border-gray-700 shadow-md space-y-6 mt-6 flex flex-col items-center">

        {/* Send Button */}
        <button
          onClick={sendToBackend}
          className="w-56 px-6 py-3 bg-blue-600 text-white font-medium rounded-md shadow
                    hover:bg-blue-700 hover:scale-105 transition duration-200 transform active:scale-95"
        >
          🚀 Send data to Flask
        </button>

        {/* Status Message */}
        <div className="min-h-[2rem] text-base text-center">
          {!processing && !done && (
            <p className="text-gray-400">Waiting to start...</p>
          )}

          {processing && (
            <p className="text-blue-400 animate-pulse">⏳ Processing... Please wait.</p>
          )}

          {done && (
            <p className="text-green-400 font-semibold">
              ✅ Processing Complete! Click <span className="underline">"Get data"</span>.
            </p>
          )}
        </div>

        {/* Get Button */}
        <button 
          onClick={handleFetchProcessedImages} 
          disabled={!done}
          className="w-56 px-6 py-3 bg-blue-600 text-white font-medium rounded-md shadow
                    transition duration-200 transform
                    hover:bg-blue-700 hover:scale-105
                    active:scale-95
                    disabled:bg-gray-600 disabled:text-gray-300 disabled:cursor-not-allowed disabled:scale-100 disabled:shadow-none"
        >
          📦 Get data from Flask
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
              {trendImage ? (
              <img src={trendImage} alt="Trend" className="w-full h-full object-contain" />
            ) : (
              <p>Trend Chart</p> // Placeholder text before image is loaded
            )}
          </div>
        </div>
      </div>

      {/* Seperator */}
      <div className="flex w-6/10 mx-auto">
        <hr className="my-8 border-t-2 border-gray-300 w-full" />
      </div>

      {/* Describes the progress */}
      <div className="w-6/10 mx-auto bg-black text-white border border-gray-700 p-6 rounded-md shadow-md">
        <h2 className="text-2xl font-bold mb-4 text-center">Disccusion</h2>

        <p className="text-base leading-relaxed text-justify mb-6">
          Mask R-CNN and SAM (Segment Anything Model) are both powerful tools for image segmentation, but they 
          are built for different purposes and excel in different contexts. Mask R-CNN is a supervised deep 
          learning model that performs instance segmentation by detecting objects, classifying them, and 
          generating pixel-wise masks for each object. It is highly effective when trained on a specific dataset, 
          such as coral images, allowing it to become specialized and accurate in segmenting and labeling 
          objects of that domain. In contrast, SAM is a promptable, general-purpose segmentation model that 
          can generate high-quality masks for arbitrary objects without needing class labels or retraining. 
          It responds to user prompts—such as clicks, boxes, or prior masks—and produces segmentation results 
          in a flexible, interactive way.

          <br /><br />

          Despite their differences, Mask R-CNN and SAM can complement each other well in real-world workflows. 
          For example, SAM’s ability to generate segmentation masks quickly and flexibly makes it ideal for 
          creating annotated datasets. These masks can then be used to train Mask R-CNN on a specific domain, 
          like marine biology, enabling it to perform faster and more consistent inference in automated systems. 
          In turn, Mask R-CNN can provide rapid, label-aware segmentation once trained, making it suitable for 
          large-scale applications where speed and class labels matter. By combining SAM’s generalization and 
          interactivity with Mask R-CNN’s specialization and efficiency, users can build more robust and 
          adaptable segmentation pipelines.

        </p>

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
              {SAMImage ? (
              <img src={SAMImage} alt="SAM Segmentation" className="w-full h-full object-contain" />
            ) : (
              <p>SAM segmentation</p> // Placeholder text before image is loaded
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col items-center w-1/2">
          <p className="text-center font-semibold text-lg mb-2">Mask R-CNN Score</p>
          <div className="w-[400px] h-[300px] border flex items-center justify-center">
            {CNNImage ? (
              <img src={CNNImage} alt="SAM Segmentation" className="w-full h-full object-contain" />
            ) : (
              <p>Mask R-CNN segmentation</p> // Placeholder text before image is loaded
            )}
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
          <p className="text-center font-semibold text-lg mb-2">SAM Interpretation</p>
          <div className="w-[400px] h-[300px] border flex items-center justify-center">
              {SAMI ? (
              <img src={SAMI} alt="SAM Segmentation" className="w-full h-full object-contain" />
            ) : (
              <p>SAM Interpretation</p> // Placeholder text before image is loaded
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col items-center w-1/2">
          <p className="text-center font-semibold text-lg mb-2">Mask R-CNN Interpretation</p>
          <div className="w-[400px] h-[300px] border flex items-center justify-center">
            {CNNI ? (
              <img src={CNNI} alt="SAM Segmentation" className="w-full h-full object-contain" />
            ) : (
              <p>Mask R-CNN Interpretation</p> // Placeholder text before image is loaded
            )}
          </div>
        </div>
      </div>

      {/* Seperator */}
      <div className="flex w-6/10 mx-auto">
        <hr className="my-8 border-t-2 border-gray-300 w-full" />
      </div>     

      {/* Conclusion */}
      <div className="w-6/10 mx-auto bg-black text-white border border-gray-700 p-6 rounded-md shadow-md">
        <h2 className="text-2xl font-bold mb-4 text-center">Conclusion</h2>
        <div>
          <h3 className="text-xl font-semibold mb-2">Key Takeaways</h3>
          <ul className="list-disc list-inside space-y-1 text-base">
            <li>Mask R-CNN excels at label-aware, instance segmentation when trained on a specific dataset. 
              It's ideal for tasks where you need both segmentation masks and object classification.</li>
            <li>SAM offers flexible, class-agnostic segmentation using prompts. It performs well across diverse 
              domains without retraining, making it ideal for interactive or exploratory segmentation.</li>
            <li>Speed vs Flexibility: Mask R-CNN is generally faster and more lightweight, while SAM 
              trades speed for generalization and adaptability.</li>
            <li>Complementary Tools: SAM can be used to quickly create labeled masks for custom datasets, 
              which can then be used to train a domain-specific Mask R-CNN model.</li>
            <li>Combining the two enables a powerful segmentation workflow, balancing general-purpose 
              annotation and task-specific inference.</li>
          </ul>
        </div>
      </div>

      {/* Seperator */}
      <div className="flex w-6/10 mx-auto">
        <hr className="my-8 border-t-2 border-gray-300 w-full" />
      </div>    

    </div>
  );
};