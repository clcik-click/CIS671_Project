from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import numpy as np
import os
import json

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

IMAGES_FOLDER = "Images"
os.makedirs(IMAGES_FOLDER, exist_ok=True)

# Fixed height, width is calculated dynamically
SCREEN_HEIGHT = 600  

@app.route("/image-upload", methods=["POST"])
def upload():
    try:
        # 1️⃣ Get Image
        if "image" not in request.files:
            return jsonify({"error": "No image uploaded"}), 400
        
        image_file      = request.files["image"]
        image_filename  = "Original_Img.jpg"
        image_path      = os.path.join(IMAGES_FOLDER, image_filename)
        image_file.save(image_path)  # Save image

        # 2️⃣ Get Strokes
        strokes_json    = request.form.get("strokes", "[]")  # Retrieve JSON strokes
        strokes         = json.loads(strokes_json)  # Convert string to list

        # 3️⃣ Save Strokes to JSON File
        strokes_filename    = "Strokes.json"
        strokes_path        = os.path.join(IMAGES_FOLDER, strokes_filename)
        with open(strokes_path, "w") as f:
            json.dump(strokes, f, indent=4)  # Save strokes with pretty formatting

        return jsonify({
            "message": "Image and strokes saved successfully",
            "Sam_img_path": "/get-image/SAM",
            "LabTag_img_path": "/get-image/SAM"
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


from flask import send_file

@app.route("/get-image/<image_type>", methods=["GET"])
def get_image(image_type):
    """ Serves the requested processed image """
    image_paths = {
        "SAM": os.path.join(IMAGES_FOLDER, "SAM_Img.jpg"),
        "LabTag": os.path.join(IMAGES_FOLDER, "LabTag_Img.jpg"),
    }

    image_path = image_paths.get(image_type)
    if image_path and os.path.exists(image_path):
        return send_file(image_path, mimetype="image/jpeg")

    return jsonify({"error": f"{image_type} image not found"}), 404


if __name__ == "__main__":
    app.run(debug=True)
