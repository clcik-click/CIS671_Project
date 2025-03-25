const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

//  Upload image and strokes to the backend
export const sendDataToBackend = async (image: File, strokes: any[]): Promise<boolean> => {
  try {
    const formData = new FormData();
    formData.append("image", image);
    formData.append("strokes", JSON.stringify(strokes));

    const response = await fetch(`${API_BASE_URL}/image-processing`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.statusText}`);
    }

    console.log("Upload successful, polling for completion...");
    return true; 
  } catch (error) {
    console.error("Error sending data:", error);
    return false;
  }
};

// Poll for processing status until the backend completes processing
export const pollProcessingStatus = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/processing-status`);
        const data = await response.json();

        console.log("Processing Status:", data.status);

        if (data.status === "done") {
          clearInterval(interval);
          resolve(true);
        }
      } catch (error) {
        console.error("Error checking processing status:", error);
      }
    }, 5000); // Check every 5 seconds
  });
};

// Fetch the processed image from the backend
export const fetchProcessedImages = async (): Promise<{ sam: string; trend: string } | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/get-processed-images`);
    if (!response.ok) {
      throw new Error("Failed to fetch processed images");
    }

    const data = await response.json();

    const samImage = `data:image/jpeg;base64,${data.sam_image}`;
    const trendImage = `data:image/jpeg;base64,${data.trend_image}`;

    return { sam: samImage, trend: trendImage };

  } catch (error) {
    console.error("Error fetching processed images:", error);
    return null;
  }
};

