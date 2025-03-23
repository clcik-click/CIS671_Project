from    segment_anything import sam_model_registry, SamAutomaticMaskGenerator
from    flask import Flask, request, jsonify, send_file
from    flask_cors import CORS
import  cv2
import  numpy as np
import  os
import  json

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

IMAGES_FOLDER       = "Images"
SAM_MODELS_FOLDER   = "SAM_models"
os.makedirs(IMAGES_FOLDER, exist_ok=True)

MODEL_PATH = os.path.join(SAM_MODELS_FOLDER, "sam_vit_b_01ec64.pth")
IMAGE_PATH = os.path.join(IMAGES_FOLDER, "Original_Img.jpg")

# Load SAM Model - using the ViT-B SAM model 
DEVICE  = "cpu" 
sam     = sam_model_registry["vit_b"](checkpoint=MODEL_PATH).to(DEVICE)

# Generate Automatic Masks
mask_generator = SamAutomaticMaskGenerator(
    sam,
    points_per_side=16,
    pred_iou_thresh=0.85,
    stability_score_thresh=0.9,
    min_mask_region_area=1000
)

import threading

# Track processing state globally
PROCESSING_STATUS = {"status": "idle"}  


# Handles image and strokes processing
@app.route("/image-processing", methods=["POST"])
def image_processing():
    global PROCESSING_STATUS
    try:
        # Mark as processing
        PROCESSING_STATUS["status"] = "processing"

        # Get Image
        if "image" not in request.files:
            return jsonify({"error": "No image uploaded"}), 400

        image_file      = request.files["image"]
        image_filename  = "Original_Img.jpg"
        image_path      = os.path.join(IMAGES_FOLDER, image_filename)

        # Save image
        image_file.save(image_path)  

        # Get Strokes
        strokes_json    = request.form.get("strokes", "[]")
        strokes         = json.loads(strokes_json)

        # Save Strokes
        strokes_filename    = "Strokes.json"
        strokes_path        = os.path.join(IMAGES_FOLDER, strokes_filename)
        with open(strokes_path, "w") as f:
            json.dump(strokes, f, indent=4)

        # Run Image Segmentation in a Separate Thread
        thread = threading.Thread(target=run_image_segmentation, args=(image_path,))
        thread.start()

        # 202 Accepted: Processing in Progress
        return jsonify({"message": "Processing started"}), 202  

    except Exception as e:
        PROCESSING_STATUS["status"] = "error"
        return jsonify({"error": str(e)}), 500

# Handles image segmentation
def run_image_segmentation(image_path):
    global PROCESSING_STATUS
    try:
        # Load and Convert Image
        image = cv2.imread(image_path)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

        # Generate Masks
        masks = mask_generator.generate(image)

        # Save Processed Image
        save_masks(image, masks, os.path.join(IMAGES_FOLDER, "SAM_Img.jpg"))

        # Update Processing Status
        PROCESSING_STATUS["status"] = "done"

    except Exception as e:
        PROCESSING_STATUS["status"] = "error"
        print(f"Error in image processing: {e}")

# Handles saving image with masks
def save_masks(image, masks, output_path="overlay_image.png"):
    if len(masks) == 0:
        print("No masks to save.")
        return

    # Sort masks by area (largest first)
    sorted_masks = sorted(masks, key=lambda x: x['area'], reverse=True)

    # Create an RGBA image for overlay (same size as original)
    img = np.ones((sorted_masks[0]['segmentation'].shape[0], 
                   sorted_masks[0]['segmentation'].shape[1], 4))
    img[:, :, 3] = 0  # Set full transparency initially

    # Apply sorted masks with random colors
    for mask in sorted_masks:
        m           = mask['segmentation']
        color_mask  = np.concatenate([np.random.random(3), [0.35]])
        img[m]      = color_mask  

    # Convert mask overlay to 3-channel BGR image for OpenCV
    mask_overlay    = (img[:, :, :3] * 255).astype(np.uint8)  # RGB mask
    alpha_mask      = img[:, :, 3]  # Alpha channel for transparency

    # Blend only where the mask is present
    for c in range(3):  # Apply alpha blending per channel (R, G, B)
        image[:, :, c] = (1 - alpha_mask) * image[:, :, c] + alpha_mask * mask_overlay[:, :, c]

    # Save the image
    cv2.imwrite(output_path, cv2.cvtColor(image, cv2.COLOR_RGB2BGR)) 
    print(f"Saved overlay image to {output_path}")

# Handles status updating
@app.route("/processing-status", methods=["GET"])
def processing_status():
    return jsonify(PROCESSING_STATUS)

# Handles image fetching from React
@app.route("/get-processed-image", methods=["GET"])
def get_processed_image():
    image_path = os.path.join(IMAGES_FOLDER, "SAM_Img.jpg")
    if os.path.exists(image_path):
        return send_file(image_path, mimetype="image/jpeg")
    return jsonify({"error": "Processed image not found"}), 404

if __name__ == "__main__":
    app.run(debug=True)
