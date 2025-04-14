from    flask import Flask, request, jsonify, send_file
from    flask_cors import CORS
from    segment_anything import sam_model_registry, SamAutomaticMaskGenerator
from    torchvision.transforms import functional as F
from    skimage.measure import label
from    matplotlib.patches import Patch

import  numpy as np
import  matplotlib.pyplot as plt
import  pandas as pd
import  cv2
import  torch
import  torchvision
import  json
import  csv
import  os
import  base64

# Disable the GUIT backend - gets rid of the warnings
import matplotlib
matplotlib.use('Agg')
import  matplotlib.pyplot as plt

MODEL_PATH      = "SAM_models/sam_vit_b_01ec64.pth"
IMAGE_PATH      = "Images/Original_Img.jpg"
STROKES_PATH    = "Images/Strokes.json" 
TREND_PATH      = "Images/Trend.jpg"
SAM_PATH        = "Images/SAM_Img.jpg"
CNN_PATH        = "Images/CNN_Img.jpg"
SAM_I_PATH      = "Images/SAM_I_Img.jpg"
CNN_I_PATH      = "Images/CNN_I_Img.jpg"

app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Load SAM Model - using the ViT-B SAM model 

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

        # Save image
        image_file.save(IMAGE_PATH)  

        # Get Strokes
        strokes_json    = request.form.get("strokes", "[]")
        strokes         = json.loads(strokes_json)

        # Save Strokes
        with open(STROKES_PATH, "w") as f:
            json.dump(strokes, f, indent=4)

        # Run Image Segmentation in a Separate Thread
        thread = threading.Thread(target=run_image_segmentation, args=(image_file,))
        thread.start()

        # 202 Accepted: Processing in Progress
        return jsonify({"message": "Processing started"}), 202  

    except Exception as e:
        PROCESSING_STATUS["status"] = "error"
        return jsonify({"error": str(e)}), 500

# Handles image segmentation
def run_image_segmentation(image_file):
    global PROCESSING_STATUS
    try:
        # Step 1: Full image masks detection
        SAM_masks, CNN_prediction, image = masks_detection()
        SAM_interpretation(SAM_masks, image)
        CCN_interpretation(CNN_prediction, image)
        print(f"[INFO] Step 1 - Full image masks detection - complete.")

        # Step 2: User-mask processing
        user_mask = user_mask_processing(image)
        print(f"[INFO] Step 2 - User mask processing - complete.")

        # Step 3: Masks comparing
        SAM_USER_combined_mask, SAM_combined_mask, CNN_USER_combined_mask, CNN_combined_mask = masks_comparision(user_mask, CNN_prediction, SAM_masks)
        print(f"[INFO] Step 3 - Masks comparing - complete.")

        # Step 4: Create visualizations
        create_vis(SAM_USER_combined_mask, SAM_combined_mask, SAM_PATH, image, "SAM")
        create_vis(CNN_USER_combined_mask, CNN_combined_mask, CNN_PATH, image, "CNN")
        print(f"[INFO] Step 4 - Create visualizations - complete.")

        # Step 5: Update trend visualization
        trend_vis()
        print(f"[INFO] Step 5 - Update trend visualization - complete.")

        # Update Processing Status
        PROCESSING_STATUS["status"] = "done"

    except Exception as e:
        PROCESSING_STATUS["status"] = "error"
        print(f"Error in image processing: {e}")

# Move these to a different py when done
def masks_detection():
    # Load and prepare an image - BGR to RGB
    image = cv2.imread(IMAGE_PATH)
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    # SAM
    # Load SAM Model - using the ViT-B SAM model 
    DEVICE = "cpu" 
    sam    = sam_model_registry["vit_b"](checkpoint=MODEL_PATH).to(DEVICE)

    # Create an automatic mask generator 
    mask_generator = SamAutomaticMaskGenerator(
        sam,
        points_per_side         = 16,  
        pred_iou_thresh         = 0.85, 
        stability_score_thresh  = 0.9,
        min_mask_region_area    = 1000
    )

    # CNN
    # Load Mask R-CNN Model
    image_tensor    = F.to_tensor(image).unsqueeze(0)  # shape: [1, 3, H, W]
    model           = torchvision.models.detection.maskrcnn_resnet50_fpn(pretrained=True)
    model.eval()

    # Inference
    with torch.no_grad():
        CNN_prediction = model(image_tensor)[0]

    # Generate masks
    SAM_masks = mask_generator.generate(image)
    # CNN_masks = prediction['masks'].cpu().numpy() 
    return SAM_masks, CNN_prediction, image

def show_anns(anns):
    if len(anns) == 0:
        return
    sorted_anns = sorted(anns, key=(lambda x: x['area']), reverse=True)
    ax          = plt.gca()
    ax.set_autoscale_on(False)

    img = np.ones((sorted_anns[0]['segmentation'].shape[0], sorted_anns[0]['segmentation'].shape[1], 4))
    img[:,:,3] = 0
    for ann in sorted_anns:
        m           = ann['segmentation']
        color_mask  = np.concatenate([np.random.random(3), [0.35]])
        img[m]      = color_mask
    ax.imshow(img)

# SAM interpretation
def SAM_interpretation(SAM_masks, image):
    image = image.copy()
    plt.figure(figsize=(12, 9))
    plt.imshow(image)
    show_anns(SAM_masks)
    plt.axis("off")
    plt.tight_layout()
    plt.savefig(SAM_I_PATH)
    plt.close()

# CNN interpretation
def CCN_interpretation(CNN_prediction, image):
    visual_image = image.copy()

    # Loop through predictions
    for i in range(len(CNN_prediction['boxes'])):
        if CNN_prediction['scores'][i] < 0.7:
            continue

        # Extract bounding box, label, and mask
        box         = CNN_prediction['boxes'][i].cpu().numpy().astype(int)
        label_id    = CNN_prediction['labels'][i].item()
        mask        = (CNN_prediction['masks'][i, 0].cpu().numpy() > 0.5).astype(np.uint8)

        # Random color for mask and box
        color = np.random.randint(0, 255, (3,), dtype=int).tolist()

        # Apply colored mask
        colored_mask = np.stack([mask * c for c in color], axis=-1)
        visual_image = cv2.addWeighted(visual_image, 1.0, colored_mask, 0.5, 0)

        # Draw bounding box and label
        cv2.rectangle(visual_image, (box[0], box[1]), (box[2], box[3]), color, 2)
        cv2.putText(visual_image, f"Label: {label_id}", (box[0], box[1] - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

    # Resize for display
    max_height  = 800
    scale       = max_height / visual_image.shape[0]
    resized     = cv2.resize(visual_image, (int(visual_image.shape[1] * scale), max_height))

    # Show with matplotlib
    plt.figure(figsize=(12, 9))
    plt.imshow(resized)
    plt.axis("off")
    plt.tight_layout()
    plt.savefig(CNN_I_PATH)
    plt.close()

def user_mask_processing(image):
    img_height, img_width   = image.shape[:2]

    # Prepare blank mask
    user_mask = np.zeros((img_height, img_width), dtype=np.uint8)

    # Load strokes
    with open(STROKES_PATH, "r") as f:
        strokes_data = json.load(f)

    # Draw strokes on mask
    for stroke in strokes_data:
        points = np.array([[int(p["x"]), int(p["y"])] for p in stroke["points"]], dtype=np.int32)
        points = points.reshape((-1, 1, 2))
        cv2.fillPoly(user_mask, [points], color=1)

    # Optionally fill
    user_mask = cv2.dilate(user_mask, np.ones((3, 3), np.uint8), iterations=1)
    user_mask = cv2.morphologyEx(user_mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    user_mask = (user_mask > 0).astype(np.uint8)

    return user_mask

def compute_iou(mask1, mask2):
    intersection = np.logical_and(mask1, mask2).sum()
    union = np.logical_or(mask1, mask2).sum()
    return intersection / union if union > 0 else 0.0

def compare_masks(USER_binary_masks, AUTO_binary_masks, USER_combined_mask, AUTO_combined_mask):
    ious    = []
    for i, u_mask in enumerate(USER_binary_masks):
        best_iou = 0
        best_idx = -1
        for j, b_mask in enumerate(AUTO_binary_masks):
            if b_mask.shape != u_mask.shape:
                b_mask = cv2.resize(b_mask, (u_mask.shape[1], u_mask.shape[0]), interpolation=cv2.INTER_NEAREST)

            iou = compute_iou(u_mask, b_mask)
            if iou > best_iou:
                best_iou = iou
                best_idx = j

        if best_idx == -1:
            print(f"[WARN] No matching mask found for user region {i}")
            continue

        best_masks          = AUTO_binary_masks[best_idx]
        USER_combined_mask  = np.logical_or(USER_combined_mask, u_mask)
        AUTO_combined_mask  = np.logical_or(AUTO_combined_mask, best_masks)
        ious.append(best_iou)
    
    avg_iou = sum(ious) / len(ious) if ious else 0
    return USER_combined_mask, AUTO_combined_mask, avg_iou

def masks_comparision(user_mask, CNN_prediction, SAM_masks):
    USER_combined_mask  = np.zeros_like(user_mask)
    user_labeled        = label(user_mask)
    num_regions         = np.max(user_labeled)
    USER_binary_masks   = [(user_labeled == i).astype(np.uint8) for i in range(1, num_regions + 1)]

    score_threshold = 0.7
    scores = CNN_prediction['scores'].cpu().numpy()
    keep_indices = np.where(scores >= score_threshold)[0]   
    CNN_masks = CNN_prediction['masks'][keep_indices].cpu().numpy()[:, 0]
    CNN_combined_mask = np.zeros_like(user_mask)
    CNN_binary_masks = (CNN_masks > 0.5).astype(np.uint8)

    SAM_combined_mask   = np.zeros_like(user_mask)
    SAM_binary_masks    = [m["segmentation"].astype(np.uint8) for m in SAM_masks]

    SAM_USER_combined_mask, SAM_combined_mask, SAM_avg_iou = compare_masks(USER_binary_masks, SAM_binary_masks, USER_combined_mask, SAM_combined_mask)
    CNN_USER_combined_mask, CNN_combined_mask, CNN_avg_iou = compare_masks(USER_binary_masks, CNN_binary_masks, USER_combined_mask, CNN_combined_mask)
    SC_iou = compute_iou(SAM_combined_mask, CNN_combined_mask)

    # Save to the results to a file
    csv_file        = "iou_results.csv"
    write_header    = not os.path.exists(csv_file)

    with open(csv_file, "a", newline="") as f:
        writer = csv.writer(f)
        if write_header:
            writer.writerow(["SAM_avg_iou", "CNN_avg_iou", "SC_iou"])
        writer.writerow([SAM_avg_iou, CNN_avg_iou, SC_iou])

    return SAM_USER_combined_mask, SAM_combined_mask, CNN_USER_combined_mask, CNN_combined_mask

def create_vis(User_combined_mask, Auto_combined_mask, Image_Path, image, label_txt):
    # Red = user, Green = auto, Yellow = overlap
    user    = np.logical_and(User_combined_mask == 1, Auto_combined_mask == 0)
    auto    = np.logical_and(User_combined_mask == 0, Auto_combined_mask== 1)
    both    = np.logical_and(User_combined_mask == 1, Auto_combined_mask == 1)

    overlay_mask = np.zeros_like(image)
    overlay_mask[user]  = [255, 0, 0]     # Red
    overlay_mask[auto]  = [0, 255, 0]     # Green
    overlay_mask[both]  = [255, 255, 0]   # Yellow

    # Blend with original image
    alpha = 0.4
    final_overlay = cv2.addWeighted(image, 1.0, overlay_mask, alpha, 0)
    plt.figure(figsize=(12, 9))
    plt.imshow(final_overlay)
    plt.axis("off")

    # Add legend
    legend_elements = [
        Patch(facecolor='red',   edgecolor='black', label='User'),
        Patch(facecolor='green', edgecolor='black', label= label_txt),
        Patch(facecolor='yellow',edgecolor='black', label='Overlap'),
    ]
    plt.legend(handles=legend_elements, loc='lower right', fontsize=10)

    plt.subplots_adjust(left=0, right=1, top=1, bottom=0)
    plt.tight_layout()
    plt.savefig(Image_Path, bbox_inches='tight', pad_inches=0)

def trend_vis():
    df = pd.read_csv("iou_results.csv")

    # Compute averages
    avg_sam = df["SAM_avg_iou"].mean()
    avg_cnn = df["CNN_avg_iou"].mean()
    avg_sc  = df["SC_iou"].mean()

    # Plot
    plt.figure(figsize=(12, 9))

    # Plot full lines
    plt.plot(df["SAM_avg_iou"], marker='o', label=f"SAM (avg={avg_sam:.3f})")
    plt.plot(df["CNN_avg_iou"], marker='s', label=f"CNN (avg={avg_cnn:.3f})")
    plt.plot(df["SC_iou"], marker='^', label=f"SC (avg={avg_sc:.3f})")


    # Highlight last result
    last_index = len(df) - 1
    last_sam = df["SAM_avg_iou"].iloc[-1]
    last_cnn = df["CNN_avg_iou"].iloc[-1]
    last_sc = df["SC_iou"].iloc[-1]

    plt.scatter(last_index, last_sam, color='blue', s=100, edgecolor='black', zorder=5)
    plt.scatter(last_index, last_cnn, color='orange', s=100, edgecolor='black', zorder=5)
    plt.scatter(last_index, last_sc, color='green', s=100, edgecolor='black', zorder=5)

    # Annotate latest points
    offset = 0.03
    plt.text(last_index, last_sam + offset, f"{last_sam:.3f}", color='blue', ha='center')
    plt.text(last_index, last_cnn + offset, f"{last_cnn:.3f}", color='orange', ha='center')
    plt.text(last_index, last_sc + offset, f"{last_sc:.3f}", color='green', ha='center')

    # Labels and styling
    plt.title("IoU Comparison: SAM vs CNN vs Human")
    plt.xlabel("Index")
    plt.ylabel("IoU")
    plt.ylim(0, 1)
    plt.xticks(range(len(df)))
    plt.grid(True)
    plt.legend()
    plt.tight_layout()

    # Save and show
    plt.savefig(TREND_PATH)

# Handles status updating
@app.route("/processing-status", methods=["GET"])
def processing_status():
    return jsonify(PROCESSING_STATUS)

# Handles image fetching from React
@app.route("/get-processed-images", methods=["GET"])
def get_processed_images():
    if not os.path.exists(SAM_PATH) or not os.path.exists(TREND_PATH):
        return jsonify({"error": "One or more images not found"}), 404

    def encode_image_to_base64(path):
        with open(path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode("utf-8")

    sam_img_b64     = encode_image_to_base64(SAM_PATH)
    sam_i_b64       = encode_image_to_base64(SAM_I_PATH)
    cnn_img_b64     = encode_image_to_base64(CNN_PATH)
    cnn_i_b64       = encode_image_to_base64(CNN_I_PATH)
    trend_img_b64   = encode_image_to_base64(TREND_PATH)

    return jsonify({
        "sam_image":    sam_img_b64,
        "sam_i":        sam_i_b64,
        "cnn_image":    cnn_img_b64,
        "cnn_i":        cnn_i_b64,
        "trend_image":  trend_img_b64
    })

if __name__ == "__main__":
    app.run(debug=True)