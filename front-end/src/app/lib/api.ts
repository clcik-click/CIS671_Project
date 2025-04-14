// ================= Backend Communication =================

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || "http://127.0.0.1:5000";

// Upload image and strokes to the backend
export const sendDataToBackend = async (image: File, strokes: any[]): Promise<boolean> => {
  try {
    // Prepare multipart/form-data
    const formData = new FormData();
    formData.append("image", image);                      // Append image file
    formData.append("strokes", JSON.stringify(strokes));  // Append user-drawn strokes as JSON

    // Send POST request to Flask API
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

// Poll Flask backend until processing is complete
export const pollProcessingStatus = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/processing-status`);
        const data = await response.json();

        console.log("Processing Status:", data.status);

        // Stop polling if backend is done
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

// Retrieve processed images (base64 encoded) from backend
export const fetchProcessedImages = async (): Promise<{ sam: string; samI: string; cnn: string; cnnI: string; trend: string } | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/get-processed-images`);
    if (!response.ok) {
      throw new Error("Failed to fetch processed images");
    }

    const data = await response.json();

    // Convert base64 strings into image sources
    const sam   = `data:image/jpeg;base64,${data.sam_image}`;
    const samI  = `data:image/jpeg;base64,${data.sam_i}`;
    const cnn   = `data:image/jpeg;base64,${data.cnn_image}`;
    const cnnI  = `data:image/jpeg;base64,${data.cnn_i}`;
    const trend = `data:image/jpeg;base64,${data.trend_image}`;

    return { sam: sam, samI: samI, cnn: cnn, cnnI: cnnI, trend: trend };

  } catch (error) {
    console.error("Error fetching processed images:", error);
    return null;
  }
};

