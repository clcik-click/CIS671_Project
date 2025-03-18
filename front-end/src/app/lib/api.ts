export const sendDataToBackend = async (image: File, strokes: any[]) => {
    try {
      const formData = new FormData();
      formData.append("image", image); // Append image
      formData.append("strokes", JSON.stringify(strokes)); // Append strokes as JSON
  
      const response = await fetch("http://127.0.0.1:5000/image-upload", {
        method: "POST",
        body: formData,
      });
  
      const data = await response.json();
      console.log("Response from server:", data);
    } catch (error) {
      console.error("Error sending data:", error);
    }
  };
  
export const fetchSAMImage = async () => {
  try {
      const response = await fetch("http://localhost:5000/get-image/SAM");
      
      if (!response.ok) {
          throw new Error("SAM image not found");
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob); // Returns an image URL for React
  } catch (error) {
      console.error("Error fetching SAM image:", error);
      return null;
  }
};



